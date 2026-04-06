import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { runFullSync } from "@/lib/integrations/excel/sync";

export const runtime = "nodejs";

function isSupportedWorkbookFile(fileName: string, contentType: string) {
  const lowerName = fileName.toLowerCase();
  return (
    lowerName.endsWith(".xlsx") ||
    lowerName.endsWith(".xls") ||
    lowerName.endsWith(".csv") ||
    contentType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
    contentType === "application/vnd.ms-excel" ||
    contentType === "text/csv"
  );
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const formData = await request.formData();
    const fileEntry = formData.get("file");
    const workbookLabel = typeof formData.get("name") === "string" ? String(formData.get("name")).trim() : "";

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Excel workbook file is required" }, { status: 400 });
    }

    if (!isSupportedWorkbookFile(fileEntry.name || "", fileEntry.type || "")) {
      return NextResponse.json(
        { error: "Unsupported file type. Upload an .xlsx, .xls, or .csv file." },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await fileEntry.arrayBuffer());
    const nowIso = new Date().toISOString();
    const existingSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "excel")
      .limit(1)
      .get();

    let integrationId: string;
    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.set(
        {
          user_id: user.uid,
          provider: "excel",
          provider_account_id: fileEntry.name || "excel-workbook",
          provider_account_name: workbookLabel || fileEntry.name || "Excel workbook",
          access_token_enc: "",
          refresh_token_enc: "",
          token_iv: "",
          scopes: [],
          token_expires_at: null,
          status: "active",
          sync_cursor: {
            source_file_name: fileEntry.name || "workbook.xlsx",
          },
          updated_at: nowIso,
        },
        { merge: true }
      );
      integrationId = existingDoc.id;
    } else {
      const docRef = await adminDb.collection(COLLECTIONS.INTEGRATIONS).add({
        user_id: user.uid,
        provider: "excel",
        provider_account_id: fileEntry.name || "excel-workbook",
        provider_account_name: workbookLabel || fileEntry.name || "Excel workbook",
        access_token_enc: "",
        refresh_token_enc: "",
        token_iv: "",
        scopes: [],
        token_expires_at: null,
        status: "active",
        sync_cursor: {
          source_file_name: fileEntry.name || "workbook.xlsx",
        },
        created_at: nowIso,
        updated_at: nowIso,
      });
      integrationId = docRef.id;
    }

    const result = await runFullSync(adminDb, user.uid, integrationId, {
      fileBuffer,
      fileName: fileEntry.name || "workbook.xlsx",
    });

    return NextResponse.json({
      success: true,
      integrationId,
      message: `Excel workbook "${result.workbookName}" connected successfully.`,
      synced: {
        workbooks: 1,
        sheets: result.sheetCount,
        rows: result.rowCount,
      },
    });
  } catch (error) {
    console.error("Excel connect error:", error);
    if (typeof error === "object" && error !== null) {
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
      } catch {
        // Ignore cleanup failures here.
      }
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to connect Excel workbook" },
      { status: 500 }
    );
  }
}