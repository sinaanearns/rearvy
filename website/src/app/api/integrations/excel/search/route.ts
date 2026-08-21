import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type { ExcelRowRecord } from "@/lib/integrations/excel/sync";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ExcelSearchApi");

type ExcelSearchRow = ExcelRowRecord & {
  id: string;
};

function tokenizeQuery(query: string) {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function getSearchTerms(query: string) {
  const tokens = tokenizeQuery(query);
  const preferredTerms = tokens.filter((token) => /[a-z]/i.test(token));
  return preferredTerms.length > 0 ? preferredTerms.slice(0, 8) : tokens.slice(0, 8);
}

function normalizeLimit(value: string | null) {
  const parsed = Number(value || 10);
  return Math.max(1, Math.min(Number.isFinite(parsed) ? Math.floor(parsed) : 10, 25));
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) {
      return error;
    }

    const query = (request.nextUrl.searchParams.get("q") || "").trim().slice(0, 200);
    const limit = normalizeLimit(request.nextUrl.searchParams.get("limit"));
    const terms = getSearchTerms(query);

    const snapshot = await adminDb
      .collection(COLLECTIONS.EXCEL_ROWS)
      .where("user_id", "==", user.uid)
      .get();

    const rows = snapshot.docs
      .map((doc): ExcelSearchRow => ({ id: doc.id, ...(doc.data() as ExcelRowRecord) }))
      .filter((row) => {
        const searchText = String(row.search_text || "").toLowerCase();
        if (!terms.length) return true;
        return terms.some((term) => searchText.includes(term));
      })
      .slice(0, limit)
      .map((row) => ({
        id: row.id,
        workbookId: row.workbook_id,
        sheetName: row.sheet_name,
        rowIndex: row.row_index,
        data: row.data,
        searchText: row.search_text,
      }));

    return NextResponse.json({ query, terms, rows });
  } catch (error) {
    log.error("Excel search route error:", error);
    return NextResponse.json({ error: "Failed to search Excel rows" }, { status: 500 });
  }
}
