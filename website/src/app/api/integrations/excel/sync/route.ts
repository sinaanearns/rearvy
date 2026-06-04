import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { runFullSync } from "@/lib/integrations/excel/sync";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
const log = createServerLogger("ExcelSyncApi");

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "excel")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json({ error: "No active Excel integration found" }, { status: 404 });
    }

    const doc = snapshot.docs[0];
    const result = await runFullSync(adminDb, user.uid, doc.id);

    return NextResponse.json({
      success: true,
      synced: {
        workbooks: 1,
        sheets: result.sheetCount,
        rows: result.rowCount,
        importedRows: result.importedRows,
      },
    });
  } catch (error) {
    log.error("Excel sync error:", error);
    try {
      const snapshot = await adminDb
        .collection(COLLECTIONS.INTEGRATIONS)
        .where("user_id", "==", user.uid)
        .where("provider", "==", "excel")
        .limit(1)
        .get();

      if (!snapshot.empty) {
        await snapshot.docs[0].ref.set({ status: "error", updated_at: new Date().toISOString() }, { merge: true });
      }
    } catch (cleanupError) {
      log.warn("Failed to mark Excel integration sync as errored:", cleanupError);
    }
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
