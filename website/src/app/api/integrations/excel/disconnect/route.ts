import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { disconnectExcelWorkbook } from "@/lib/integrations/excel/sync";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "excel")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No Excel integration found" }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    await disconnectExcelWorkbook(adminDb, doc.id);

    return NextResponse.json({ success: true, message: "Excel workbook disconnected successfully." });
  } catch (error) {
    console.error("Excel disconnect error:", error);
    return NextResponse.json(
      { error: "Disconnect failed" },
      { status: 500 }
    );
  }
}