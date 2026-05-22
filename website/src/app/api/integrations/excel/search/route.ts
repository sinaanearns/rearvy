import { NextResponse, type NextRequest } from "next/server";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

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

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    const userId = decodedToken.uid;

    const query = request.nextUrl.searchParams.get("q") || "";
    const limit = Math.max(1, Math.min(Number(request.nextUrl.searchParams.get("limit") || 10) || 10, 25));
    const terms = getSearchTerms(query);

    const snapshot = await adminDb.collection(COLLECTIONS.EXCEL_ROWS).where("user_id", "==", userId).get();

    const rows = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
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
    console.error("Excel search route error:", error);
    return NextResponse.json({ error: "Failed to search Excel rows" }, { status: 500 });
  }
}