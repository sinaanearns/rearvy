import "server-only";

import { mkdir, readFile, rm, writeFile } from "fs/promises";
import path from "path";
import * as XLSX from "xlsx";
import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
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

export type ExcelWorkbookArtifact = ExcelWorkbookSummary & {
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

function parseWorkbookBuffer(fileBuffer: Buffer, fileName: string): ExcelWorkbookArtifact {
  const isCsv = /\.csv$/i.test(fileName);
  const workbook = isCsv
    ? XLSX.read(fileBuffer.toString("utf8"), {
        type: "string",
        cellDates: true,
        raw: false,
      })
    : XLSX.read(fileBuffer, {
        type: "buffer",
        cellDates: true,
        raw: false,
      });

  const sheets = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: "",
      blankrows: false,
    });
    const rows = normalizeSheetRows(rawRows);
    const previewRows = rows.slice(0, 3);
    const columns = Array.from(
      rows.reduce((set, row) => {
        Object.keys(row).forEach((key) => set.add(key));
        return set;
      }, new Set<string>())
    );

    return {
      name: sheetName,
      rowCount: rows.length,
      importedRowCount: Math.min(rows.length, MAX_ROWS_PER_SHEET),
      columnCount: columns.length,
      columns,
      previewRows,
      truncated: rows.length > MAX_ROWS_PER_SHEET,
      rows: rows.slice(0, MAX_ROWS_PER_SHEET),
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
  const summary = parseWorkbookBuffer(buffer, file.name || "workbook.xlsx");
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
  const absolutePath = path.join(process.cwd(), "public", relativePath);

  await mkdir(path.dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, buffer);

  return relativePath;
}

async function readExcelWorkbookBufferFromPath(relativePath: string) {
  const absolutePath = path.join(process.cwd(), "public", relativePath);
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

  if (!clientId || !clientSecret) {
    throw new Error("Missing Microsoft OAuth credentials");
  }

  const tokenRes = await fetch("https://login.microsoftonline.com/common/oauth2/v2.0/token", {
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

async function getMicrosoftGraphAccessToken(db: Firestore, integrationId: string, integration: any) {
  const refreshIv = integration.sync_cursor?.refresh_iv;
  if (!integration.access_token_enc || !integration.refresh_token_enc || !integration.token_iv || !refreshIv) {
    throw new Error("Excel integration is missing Microsoft OAuth tokens");
  }

  const expiresAt = integration.token_expires_at ? Date.parse(integration.token_expires_at) : 0;
  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);

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

async function pickMicrosoftWorkbookItem(accessToken: string, integration: any) {
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
  const integration = integrationSnapshot.data();

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

  const integration = integrationSnapshot.data();
  if (!integration || integration.user_id !== userId || integration.provider !== "excel") {
    throw new Error("Excel integration not found");
  }

  if (integration.access_token_enc && integration.refresh_token_enc && integration.token_iv && integration.sync_cursor?.refresh_iv) {
    return runMicrosoftGraphSync(db, userId, integrationId);
  }

  const existingFilePath = integration.sync_cursor?.source_file_path;
  const existingFileName = integration.sync_cursor?.source_file_name || integration.provider_account_name || "workbook.xlsx";

  const fileBuffer =
    options.fileBuffer ||
    (typeof existingFilePath === "string" && existingFilePath.trim().length > 0
      ? await readExcelWorkbookBufferFromPath(existingFilePath)
      : null);

  if (!fileBuffer) {
    throw new Error("Excel workbook file is missing");
  }

  const sourceFileName = options.fileName || existingFileName;
  const summary = parseWorkbookBuffer(fileBuffer, sourceFileName);
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
      sheets: summary.sheets.map(({ rows: _rows, ...sheet }) => sheet),
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