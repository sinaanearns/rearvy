import "server-only";

import { mkdir, readFile, rm, writeFile } from "fs/promises";
import os from "os";
import path from "path";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS, type Integration } from "@/lib/firebase/schema";
import { decrypt, encrypt } from "@/lib/utils/encryption";

const MAX_ROWS_PER_SHEET = 200;
const FIRESTORE_BATCH_SIZE = 450;

export type ExcelRowRecord = {
  user_id: string;
  integration_id: string;
  workbook_id: string;
  sheet_name: string;
  row_index: number;
  data: Record<string, unknown>;
  search_text: string;
  created_at: string;
  updated_at: string;
};

export type ExcelSheetSummary = {
  name: string;
  rowCount: number;
  importedRowCount: number;
  columnCount: number;
  columns: string[];
  previewRows: Array<Record<string, unknown>>;
  truncated: boolean;
};

export type ExcelWorkbookSummary = {
  workbookName: string;
  sourceFileName: string;
  sheetCount: number;
  totalRows: number;
  sheets: ExcelSheetSummary[];
};

type ParsedExcelSheet = ExcelSheetSummary & {
  rows: Array<Record<string, unknown>>;
};

export type ExcelWorkbookArtifact = Omit<ExcelWorkbookSummary, "sheets"> & {
  sheets: ParsedExcelSheet[];
  buffer: Buffer;
  localFilePath: string;
  contentType: string;
};

function sanitizeFileName(name: string) {
  const normalized = name.trim().replace(/[/\\?%*:|"<>]/g, "-");
  return normalized.length > 0 ? normalized : "workbook";
}

function getWorkbookName(fileName: string) {
  return sanitizeFileName(fileName).replace(/\.(xlsx|xls|csv)$/i, "");
}

function toPreviewValue(value: unknown) {
  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}

function buildSearchText(row: Record<string, unknown>) {
  return Object.values(row)
    .map((value) => toPreviewValue(value))
    .filter(Boolean)
    .join(" ")
    .slice(0, 5000);
}

function normalizeSheetRows(rows: Array<Record<string, unknown>>) {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(row)) {
      const trimmedKey = key.trim();
      if (!trimmedKey) {
        continue;
      }

      normalized[trimmedKey] = value;
    }

    return normalized;
  });
}

async function parseWorkbookBuffer(fileBuffer: Buffer, fileName: string): Promise<ExcelWorkbookArtifact> {
  const ExcelJS = await import("exceljs");
  const isCsv = /\.csv$/i.test(fileName);
  
  let rows: Record<string, unknown>[][] = [];
  let sheetNames: string[] = [];

  if (isCsv) {
    // For CSV: parse as simple rows
    const lines = fileBuffer.toString("utf8").split("\n").filter(line => line.trim());
    if (lines.length > 0) {
      const header = lines[0].split(",").map(h => h.trim());
      sheetNames = ["Sheet1"];
      rows = lines.slice(1).map(line => {
        const values = line.split(",").map(v => v.trim());
        const obj: Record<string, unknown> = {};
        header.forEach((key, idx) => {
          obj[key] = values[idx] || "";
        });
        return [obj];
      });
    }
  } else {
    // For Excel: use ExcelJS
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(fileBuffer as never);
    sheetNames = workbook.worksheets.map(ws => ws.name);
    
    rows = workbook.worksheets.map((worksheet) => {
      const sheetRows: Record<string, unknown>[] = [];
      const headers: string[] = [];
      
      worksheet.eachRow((row, rowNum) => {
        if (rowNum === 1) {
          // First row is header
          row.eachCell((cell) => {
            headers.push(String(cell.value || ""));
          });
        } else {
          // Data rows
          const obj: Record<string, unknown> = {};
          row.eachCell((cell, colNum) => {
            const key = headers[colNum - 1] || `Column${colNum}`;
            obj[key] = cell.value || "";
          });
          sheetRows.push(obj);
        }
      });
      return sheetRows;
    });
  }

  const sheets = sheetNames.map((sheetName, idx) => {
    const rawRows = rows[idx] || [];
    const normalizedRows = normalizeSheetRows(rawRows);
    const previewRows = normalizedRows.slice(0, 3);
    const columns = Array.from(
      normalizedRows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    );

    return {
      name: sheetName,
      rowCount: rawRows.length,
      importedRowCount: Math.min(rawRows.length, MAX_ROWS_PER_SHEET),
      columnCount: columns.length,
      columns,
      previewRows,
      truncated: rawRows.length > MAX_ROWS_PER_SHEET,
      rows: normalizedRows.slice(0, MAX_ROWS_PER_SHEET),
    };
  });

  const totalRows = sheets.reduce((count, sheet) => count + sheet.importedRowCount, 0);

  return {
    workbookName: getWorkbookName(fileName),
    sourceFileName: sanitizeFileName(fileName),
    sheetCount: sheets.length,
    totalRows,
    sheets,
    buffer: fileBuffer,
    localFilePath: "",
    contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  };
}

export async function readExcelWorkbookArtifact(file: File): Promise<ExcelWorkbookArtifact> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const summary = await parseWorkbookBuffer(buffer, file.name || "workbook.xlsx");
  const contentType = file.type || "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  const localFilePath = await saveExcelWorkbookFile(buffer, file.name || "workbook.xlsx");

  return {
    ...summary,
    buffer,
    localFilePath,
    contentType,
  };
}

export async function saveExcelWorkbookFile(buffer: Buffer, fileName: string) {
  const safeFileName = sanitizeFileName(fileName);
  const relativePath = path.join(
    "excel-imports",
    `${Date.now()}-${safeFileName}`
  );
  // Use OS temp dir on serverless platforms (Vercel) where writing to
  // `public` isn't appropriate or persistent. Prefer `public` locally.
  const IS_VERCEL = Boolean(process.env.VERCEL);

  if (IS_VERCEL) {
    const tmpDir = path.join(os.tmpdir(), "rearvy-excel-imports");
    const absolutePath = path.join(tmpDir, relativePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, buffer);
    return absolutePath; // return absolute temp path on Vercel
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
}

async function readExcelWorkbookBufferFromPath(relativePath: string) {
  const IS_VERCEL = Boolean(process.env.VERCEL);
  if (IS_VERCEL && path.isAbsolute(relativePath)) {
    return readFile(relativePath);
  }

  const absolutePath = path.join(/*turbopackIgnore: true*/ process.cwd(), "public", relativePath);
  return readFile(absolutePath);
}

type MicrosoftGraphDriveItem = {
  id: string;
  name: string;
  webUrl?: string;
  lastModifiedDateTime?: string;
  file?: {
    mimeType?: string;
  };
};

type MicrosoftGraphWorksheet = {
  id: string;
  name: string;
};

function isMicrosoftExcelFile(name: string) {
  const lowerName = name.toLowerCase();
  return lowerName.endsWith(".xlsx") || lowerName.endsWith(".xlsm") || lowerName.endsWith(".xls");
}

function normalizeHeader(value: unknown, index: number) {
  const text = toPreviewValue(value).trim();
  return text.length > 0 ? text : `column_${index + 1}`;
}

function rowsFromWorksheetValues(values: unknown[][]) {
  if (!Array.isArray(values) || values.length === 0) {
    return [] as Array<Record<string, unknown>>;
  }

  const headerRow = values[0] ?? [];
  const headers = headerRow.map((value, index) => normalizeHeader(value, index));

  return values.slice(1).map((row) => {
    const record: Record<string, unknown> = {};

    headers.forEach((header, index) => {
      const cellValue = Array.isArray(row) ? row[index] : undefined;
      record[header] = cellValue ?? "";
    });

    return record;
  });
}

async function fetchMicrosoftGraphJson<T>(accessToken: string, url: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Microsoft Graph request failed (${response.status}): ${text}`);
  }

  return response.json() as Promise<T>;
}

async function refreshMicrosoftAccessToken(options: {
  refreshToken: string;
  requestRedirectUri: string;
}) {
  const clientId = process.env.MICROSOFT_CLIENT_ID;
  const clientSecret = process.env.MICROSOFT_CLIENT_SECRET;
  const tenantId = process.env.MICROSOFT_TENANT_ID?.trim() || "common";

  if (!clientId || !clientSecret) {
    throw new Error("Missing Microsoft OAuth credentials");
  }

  const tokenRes = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: options.refreshToken,
      redirect_uri: options.requestRedirectUri,
    }),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`Microsoft token refresh failed (${tokenRes.status}): ${text}`);
  }

  return tokenRes.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope?: string;
  }>;
}

async function getMicrosoftGraphAccessToken(db: Firestore, integrationId: string, integration: Integration) {
  const refreshIv = integration.sync_cursor?.refresh_iv as string | undefined;
  const accessTokenEnc = integration.access_token_enc;
  const refreshTokenEnc = integration.refresh_token_enc;
  const tokenIv = integration.token_iv;

  if (!accessTokenEnc || !refreshTokenEnc || !tokenIv || !refreshIv) {
    throw new Error("Excel integration is missing Microsoft OAuth tokens");
  }

  const expiresAt = integration.token_expires_at ? new Date(integration.token_expires_at).getTime() : 0;
  const accessToken = decrypt(accessTokenEnc, tokenIv);
  const refreshToken = decrypt(refreshTokenEnc, refreshIv);

  if (expiresAt && Date.now() < expiresAt - 60_000) {
    return { accessToken, refreshToken };
  }

  const refreshRedirectUri =
    typeof integration.sync_cursor?.oauth_redirect_uri === "string" &&
    integration.sync_cursor.oauth_redirect_uri.trim().length > 0
      ? integration.sync_cursor.oauth_redirect_uri
      : typeof process.env.NEXT_PUBLIC_APP_URL === "string" && process.env.NEXT_PUBLIC_APP_URL.trim().length > 0
      ? `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/excel/callback`
      : null;

  if (!refreshRedirectUri) {
    throw new Error("Excel OAuth redirect URI is not configured");
  }

  const refreshResult = await refreshMicrosoftAccessToken({
    refreshToken,
    requestRedirectUri: refreshRedirectUri,
  });

  const newExpiresAt = new Date(Date.now() + refreshResult.expires_in * 1000).toISOString();
  const accessEncryption = encrypt(refreshResult.access_token);
  const updateData: Record<string, unknown> = {
    access_token_enc: accessEncryption.encrypted,
    token_iv: accessEncryption.iv,
    token_expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  };

  if (refreshResult.refresh_token) {
    const refreshEncryption = encrypt(refreshResult.refresh_token);
    updateData.refresh_token_enc = refreshEncryption.encrypted;
    updateData.sync_cursor = {
      ...(integration.sync_cursor ?? {}),
      refresh_iv: refreshEncryption.iv,
    };
  }

  await db.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId).set(updateData, { merge: true });

  return {
    accessToken: refreshResult.access_token,
    refreshToken: refreshResult.refresh_token ?? refreshToken,
  };
}

async function pickMicrosoftWorkbookItem(accessToken: string, integration: Integration) {
  const storedWorkbookItemId = integration.sync_cursor?.workbook_item_id;
  if (typeof storedWorkbookItemId === "string" && storedWorkbookItemId.trim().length > 0) {
    const item = await fetchMicrosoftGraphJson<MicrosoftGraphDriveItem>(
      accessToken,
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(storedWorkbookItemId)}?$select=id,name,webUrl,lastModifiedDateTime,file`
    );

    if (item?.id) {
      return item;
    }
  }

  const listing = await fetchMicrosoftGraphJson<{ value: MicrosoftGraphDriveItem[] }>(
    accessToken,
    "https://graph.microsoft.com/v1.0/me/drive/root/children?$select=id,name,webUrl,lastModifiedDateTime,file&$top=200"
  );

  const candidates = (listing.value ?? [])
    .filter((item) => item.file?.mimeType || isMicrosoftExcelFile(item.name))
    .filter((item) => isMicrosoftExcelFile(item.name))
    .sort((left, right) => {
      const leftTime = left.lastModifiedDateTime ? Date.parse(left.lastModifiedDateTime) : 0;
      const rightTime = right.lastModifiedDateTime ? Date.parse(right.lastModifiedDateTime) : 0;
      return rightTime - leftTime;
    });

  const workbookItem = candidates[0];
  if (!workbookItem) {
    throw new Error("No Excel workbook was found in the connected Microsoft account. Save an .xlsx workbook to OneDrive and sync again.");
  }

  return workbookItem;
}

async function runMicrosoftGraphSync(db: Firestore, userId: string, integrationId: string) {
  const integrationSnapshot = await db.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId).get();
  const integration = integrationSnapshot.data() as Integration | undefined;

  if (!integration || integration.user_id !== userId || integration.provider !== "excel") {
    throw new Error("Excel integration not found");
  }

  const { accessToken } = await getMicrosoftGraphAccessToken(db, integrationId, integration);
  const workbookItem = await pickMicrosoftWorkbookItem(accessToken, integration);
  const worksheets = await fetchMicrosoftGraphJson<{ value: MicrosoftGraphWorksheet[] }>(
    accessToken,
    `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(workbookItem.id)}/workbook/worksheets?$select=id,name`
  );

  const workbookRows: ExcelRowRecord[] = [];
  const sheetSummaries: ExcelSheetSummary[] = [];

  for (const worksheet of worksheets.value ?? []) {
    const usedRange = await fetchMicrosoftGraphJson<{ values?: unknown[][] }>(
      accessToken,
      `https://graph.microsoft.com/v1.0/me/drive/items/${encodeURIComponent(workbookItem.id)}/workbook/worksheets/${encodeURIComponent(worksheet.id)}/usedRange(valuesOnly=true)?$select=values`
    );

    const rows = rowsFromWorksheetValues((usedRange.values ?? []) as unknown[][]);
    const previewRows = rows.slice(0, 3);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];
    const importedRows = rows.slice(0, MAX_ROWS_PER_SHEET);

    importedRows.forEach((row, rowIndex) => {
      workbookRows.push({
        user_id: userId,
        integration_id: integrationId,
        workbook_id: integrationId,
        sheet_name: worksheet.name,
        row_index: rowIndex,
        data: row,
        search_text: buildSearchText(row),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });

    sheetSummaries.push({
      name: worksheet.name,
      rowCount: rows.length,
      importedRowCount: importedRows.length,
      columnCount: columns.length,
      columns,
      previewRows,
      truncated: rows.length > MAX_ROWS_PER_SHEET,
    });
  }

  await deleteWorkbookRows(db, integrationId);
  await writeRowsInBatches(db, workbookRows);

  const nowIso = new Date().toISOString();
  const workbookName = workbookItem.name.replace(/\.(xlsx|xlsm|xls)$/i, "");
  const updateData = {
    status: "active",
    last_synced_at: nowIso,
    sync_cursor: {
      ...(integration.sync_cursor ?? {}),
      source_type: "microsoft_graph",
      workbook_item_id: workbookItem.id,
      workbook_name: workbookItem.name,
      workbook_web_url: workbookItem.webUrl ?? null,
      sheet_count: sheetSummaries.length,
      total_rows: workbookRows.length,
      imported_at: nowIso,
    },
    updated_at: nowIso,
  };

  await db.collection(COLLECTIONS.EXCEL_WORKBOOKS).doc(integrationId).set(
    {
      id: integrationId,
      user_id: userId,
      integration_id: integrationId,
      workbook_name: workbookName,
      source_file_name: workbookItem.name,
      source_file_path: null,
      sheet_count: sheetSummaries.length,
      total_rows: workbookRows.length,
      sheets: sheetSummaries,
      synced_at: nowIso,
      created_at: integration.created_at || nowIso,
      updated_at: nowIso,
    },
    { merge: true }
  );

  await db.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId).set(updateData, { merge: true });

  return {
    workbookName,
    sheetCount: sheetSummaries.length,
    rowCount: workbookRows.length,
    importedRows: workbookRows.length,
    sourceFilePath: null,
  };
}

async function writeRowsInBatches(db: Firestore, rows: ExcelRowRecord[]) {
  for (let index = 0; index < rows.length; index += FIRESTORE_BATCH_SIZE) {
    const batch = db.batch();
    const chunk = rows.slice(index, index + FIRESTORE_BATCH_SIZE);

    for (const row of chunk) {
      const docId = `${row.workbook_id}_${row.sheet_name}_${row.row_index}`.replace(/[^a-zA-Z0-9_-]/g, "_");
      batch.set(db.collection(COLLECTIONS.EXCEL_ROWS).doc(docId), row);
    }

    await batch.commit();
  }
}

async function deleteWorkbookRows(db: Firestore, workbookId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.EXCEL_ROWS)
    .where("workbook_id", "==", workbookId)
    .get();

  if (snapshot.empty) {
    return;
  }

  for (let index = 0; index < snapshot.docs.length; index += FIRESTORE_BATCH_SIZE) {
    const batch = db.batch();
    const chunk = snapshot.docs.slice(index, index + FIRESTORE_BATCH_SIZE);
    chunk.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
  }
}

export async function runFullSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  options: {
    fileBuffer?: Buffer;
    fileName?: string;
  } = {}
) {
  const integrationSnapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .get();

  const integration = integrationSnapshot.data() as Integration | undefined;
  if (!integration || integration.user_id !== userId || integration.provider !== "excel") {
    throw new Error("Excel integration not found");
  }

  const hasMicrosoftTokens = 
    integration.access_token_enc && 
    integration.refresh_token_enc && 
    integration.token_iv && 
    typeof integration.sync_cursor?.refresh_iv === "string";

  if (hasMicrosoftTokens) {
    return runMicrosoftGraphSync(db, userId, integrationId);
  }

  const existingFilePath = typeof integration.sync_cursor?.source_file_path === "string" ? integration.sync_cursor.source_file_path : null;
  const existingFileName = 
    (typeof integration.sync_cursor?.source_file_name === "string" ? integration.sync_cursor.source_file_name : null) || 
    integration.provider_account_name || 
    "workbook.xlsx";

  const fileBuffer =
    options.fileBuffer ||
    (typeof existingFilePath === "string" && existingFilePath.trim().length > 0
      ? await readExcelWorkbookBufferFromPath(existingFilePath)
      : null);

  if (!fileBuffer) {
    throw new Error("Excel workbook file is missing");
  }

  const sourceFileName = options.fileName || existingFileName;
  const summary: ExcelWorkbookArtifact = await parseWorkbookBuffer(fileBuffer, sourceFileName);
  const workbookId = integrationId;

  const workbookRows: ExcelRowRecord[] = [];
  summary.sheets.forEach((sheet) => {
    sheet.rows.slice(0, MAX_ROWS_PER_SHEET).forEach((row, rowIndex) => {
      workbookRows.push({
        user_id: userId,
        integration_id: integrationId,
        workbook_id: workbookId,
        sheet_name: sheet.name,
        row_index: rowIndex,
        data: row,
        search_text: buildSearchText(row),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    });
  });

  await deleteWorkbookRows(db, workbookId);
  await writeRowsInBatches(db, workbookRows);

  const localFilePath =
    options.fileBuffer
      ? await saveExcelWorkbookFile(fileBuffer, sourceFileName)
      : typeof existingFilePath === "string" && existingFilePath.trim().length > 0
      ? existingFilePath
      : await saveExcelWorkbookFile(fileBuffer, sourceFileName);

  const nowIso = new Date().toISOString();
  const updateData = {
    provider_account_name: summary.workbookName,
    status: "active",
    last_synced_at: nowIso,
    sync_cursor: {
      source_file_name: summary.sourceFileName,
      source_file_path: localFilePath,
      sheet_count: summary.sheetCount,
      total_rows: summary.totalRows,
      imported_at: nowIso,
    },
    updated_at: nowIso,
  };

  await db.collection(COLLECTIONS.EXCEL_WORKBOOKS).doc(workbookId).set(
    {
      id: workbookId,
      user_id: userId,
      integration_id: integrationId,
      workbook_name: summary.workbookName,
      source_file_name: summary.sourceFileName,
      source_file_path: localFilePath,
      sheet_count: summary.sheetCount,
      total_rows: summary.totalRows,
      sheets: summary.sheets.map((sheet) => ({
        name: sheet.name,
        rowCount: sheet.rowCount,
        importedRowCount: sheet.importedRowCount,
        columnCount: sheet.columnCount,
        columns: sheet.columns,
        previewRows: sheet.previewRows,
        truncated: sheet.truncated,
      })),
      synced_at: nowIso,
      created_at: integration.created_at || nowIso,
      updated_at: nowIso,
    },
    { merge: true }
  );

  await db.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId).set(updateData, { merge: true });

  return {
    workbookName: summary.workbookName,
    sheetCount: summary.sheetCount,
    rowCount: summary.totalRows,
    importedRows: workbookRows.length,
    sourceFilePath: localFilePath,
  };
}

export async function disconnectExcelWorkbook(db: Firestore, integrationId: string) {
  const workbookSnapshot = await db
    .collection(COLLECTIONS.EXCEL_WORKBOOKS)
    .doc(integrationId)
    .get();

  const workbook = workbookSnapshot.data();
  const sourceFilePath = workbook?.source_file_path;

  await deleteWorkbookRows(db, integrationId);
  await db.collection(COLLECTIONS.EXCEL_WORKBOOKS).doc(integrationId).delete();
  await db.collection(COLLECTIONS.INTEGRATIONS).doc(integrationId).delete();

  if (typeof sourceFilePath === "string" && sourceFilePath.trim().length > 0) {
    try {
      await rm(path.join(process.cwd(), "public", sourceFilePath), { force: true });
    } catch {
      // Ignore local file cleanup failures.
    }
  }
}