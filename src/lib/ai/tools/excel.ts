import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import { COLLECTIONS, type Integration } from "@/lib/firebase/schema";
import { isExcelIntegrationConfigured } from "@/lib/integrations/provider-config";

type ExcelWorkbookDoc = {
  workbook_name?: string | null;
  source_file_name?: string | null;
  source_file_path?: string | null;
  sheet_count?: number | null;
  total_rows?: number | null;
  sheets?: Array<{
    name?: string;
    rowCount?: number;
    importedRowCount?: number;
    columnCount?: number;
    columns?: string[];
    previewRows?: Array<Record<string, unknown>>;
    truncated?: boolean;
  }>;
  synced_at?: string | null;
  updated_at?: string | null;
};

type ExcelRowDoc = {
  sheet_name?: string;
  row_index?: number;
  data?: Record<string, unknown>;
  search_text?: string;
  updated_at?: string;
};

function summarizeIntegration(integration: Integration | null) {
  if (!integration) {
    return null;
  }

  const syncCursor = integration.sync_cursor ?? {};
  return {
    status: integration.status,
    accountName: integration.provider_account_name,
    lastSyncedAt: integration.last_synced_at,
    hasMicrosoftTokens: Boolean(
      integration.access_token_enc &&
        integration.refresh_token_enc &&
        integration.token_iv &&
        typeof syncCursor.refresh_iv === "string"
    ),
    sourceType:
      typeof syncCursor.source_type === "string" ? syncCursor.source_type : null,
    workbookName:
      typeof syncCursor.workbook_name === "string"
        ? syncCursor.workbook_name
        : typeof syncCursor.source_file_name === "string"
          ? syncCursor.source_file_name
          : null,
    totalRows:
      typeof syncCursor.total_rows === "number" ? syncCursor.total_rows : null,
    sheetCount:
      typeof syncCursor.sheet_count === "number" ? syncCursor.sheet_count : null,
  };
}

function buildDiagnostic(params: {
  configured: boolean;
  integration: Integration | null;
  workbook: ExcelWorkbookDoc | null;
  rowCount: number;
}) {
  const { configured, integration, workbook, rowCount } = params;

  if (!configured) {
    return {
      severity: "blocked",
      message:
        "Excel integration is not configured on this server. Add MICROSOFT_CLIENT_ID and MICROSOFT_CLIENT_SECRET, then restart or redeploy.",
      nextAction:
        "Configure the Microsoft OAuth app credentials and register /api/integrations/excel/callback as the redirect URI.",
    };
  }

  if (!integration) {
    return {
      severity: "not_connected",
      message: "No Excel account is connected for this user.",
      nextAction: "Open Integrations and click Connect Excel.",
    };
  }

  if (integration.status !== "active") {
    return {
      severity: "connection_error",
      message: `Excel is connected but its status is ${integration.status}.`,
      nextAction: "Reconnect Excel from Integrations, then run Sync Now.",
    };
  }

  if (!workbook) {
    return {
      severity: "not_synced",
      message: "Excel is connected, but no workbook has been imported yet.",
      nextAction:
        "Save an .xlsx workbook in OneDrive and click Sync Now in the Excel integration.",
    };
  }

  if (rowCount === 0) {
    return {
      severity: "empty_workbook",
      message: "An Excel workbook exists, but no rows are available for chat analysis.",
      nextAction:
        "Check that the workbook has header rows and data, then run Sync Now again.",
    };
  }

  return {
    severity: "ok",
    message: "Excel is connected and synced.",
    nextAction: "Ask a specific question about workbook rows, sheets, or columns.",
  };
}

export function getExcelWorkbookStatus(ctx: ToolContext) {
  return tool({
    description:
      "Diagnose the Microsoft Excel integration and summarize connected workbook, sheet, and row sync state.",
    inputSchema: z.object({}),
    execute: async () => {
      const configured = isExcelIntegrationConfigured();
      const integrationSnapshot = await ctx.adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .where("user_id", "==", ctx.userId)
        .where("provider", "==", "excel")
        .limit(1)
        .get();

      const integrationDoc = integrationSnapshot.empty
        ? null
        : integrationSnapshot.docs[0];
      const integration = integrationDoc
        ? (integrationDoc.data() as Integration)
        : null;
      const integrationId = integrationDoc?.id ?? null;

      const workbookDoc = integrationId
        ? await ctx.adminDb
            .collection(COLLECTIONS.EXCEL_WORKBOOKS)
            .doc(integrationId)
            .get()
        : null;
      const workbook =
        workbookDoc?.exists ? (workbookDoc.data() as ExcelWorkbookDoc) : null;

      const rowsSnapshot = integrationId
        ? await ctx.adminDb
            .collection(COLLECTIONS.EXCEL_ROWS)
            .where("user_id", "==", ctx.userId)
            .where("integration_id", "==", integrationId)
            .limit(1000)
            .get()
        : null;
      const rowCount = rowsSnapshot?.size ?? 0;

      return {
        ok: true,
        configured,
        integration: summarizeIntegration(integration),
        workbook: workbook
          ? {
              name: workbook.workbook_name ?? workbook.source_file_name ?? "Workbook",
              sourceFileName: workbook.source_file_name ?? null,
              sheetCount: workbook.sheet_count ?? workbook.sheets?.length ?? 0,
              totalRows: workbook.total_rows ?? rowCount,
              syncedAt: workbook.synced_at ?? workbook.updated_at ?? null,
              sheets: (workbook.sheets ?? []).slice(0, 12).map((sheet) => ({
                name: sheet.name ?? "Sheet",
                rowCount: sheet.rowCount ?? 0,
                importedRowCount: sheet.importedRowCount ?? 0,
                columnCount: sheet.columnCount ?? sheet.columns?.length ?? 0,
                columns: (sheet.columns ?? []).slice(0, 20),
                truncated: Boolean(sheet.truncated),
              })),
            }
          : null,
        rowCount,
        diagnostic: buildDiagnostic({
          configured,
          integration,
          workbook,
          rowCount,
        }),
      };
    },
  });
}

export function searchExcelRows(ctx: ToolContext) {
  return tool({
    description:
      "Search synced Excel workbook rows by text and optionally filter to a sheet.",
    inputSchema: z.object({
      query: z.string().optional().describe("Text to find in synced Excel rows."),
      sheetName: z.string().optional().describe("Optional exact sheet name."),
      limit: z.number().optional().default(10),
    }),
    execute: async ({ query, sheetName, limit }) => {
      const integrationSnapshot = await ctx.adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .where("user_id", "==", ctx.userId)
        .where("provider", "==", "excel")
        .where("status", "==", "active")
        .limit(1)
        .get();

      if (integrationSnapshot.empty) {
        return {
          ok: false,
          errorCode: "EXCEL_NOT_CONNECTED",
          message: "No active Excel integration is connected yet.",
        };
      }

      const integrationId = integrationSnapshot.docs[0].id;
      let rowsQuery = ctx.adminDb
        .collection(COLLECTIONS.EXCEL_ROWS)
        .where("user_id", "==", ctx.userId)
        .where("integration_id", "==", integrationId);

      if (sheetName) {
        rowsQuery = rowsQuery.where("sheet_name", "==", sheetName);
      }

      const snapshot = await rowsQuery.limit(1000).get();
      const normalizedQuery = query?.trim().toLowerCase() ?? "";
      const rows = snapshot.docs
        .map((doc) => doc.data() as ExcelRowDoc)
        .filter((row) => {
          if (!normalizedQuery) {
            return true;
          }

          return (
            row.search_text?.toLowerCase().includes(normalizedQuery) ||
            JSON.stringify(row.data ?? {}).toLowerCase().includes(normalizedQuery)
          );
        })
        .slice(0, Math.min(Math.max(limit ?? 10, 1), 50));

      return {
        ok: true,
        totalScanned: snapshot.size,
        matchesReturned: rows.length,
        rows: rows.map((row) => ({
          sheetName: row.sheet_name ?? "Sheet",
          rowIndex: row.row_index ?? null,
          data: row.data ?? {},
        })),
      };
    },
  });
}
