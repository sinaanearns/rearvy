import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("VerifiedConnectorCatalogApi");

export async function GET() {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.CONNECTOR_DEFINITIONS)
      .where("lifecycle_status", "==", "published")
      .limit(100)
      .get();
    const connectors = snapshot.docs.flatMap((doc) => {
      const data = doc.data();
      if (data.visibility !== "catalog") return [];
      return [
        {
          id: doc.id,
          connector_id: data.connector_id,
          connector_version: data.connector_version,
          manifest: data.manifest,
          lifecycle_status: data.lifecycle_status,
          reviewed_at: data.reviewed_at ?? null,
        },
      ];
    });

    return NextResponse.json({ connectors });
  } catch (error) {
    log.error("Unable to load verified connector catalog:", error);
    return NextResponse.json({ error: "Unable to load connector catalog." }, { status: 500 });
  }
}
