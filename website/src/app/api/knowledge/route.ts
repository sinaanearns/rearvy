import { requireAuth } from "@/lib/firebase/middleware";
import { ingestDocument } from "@/lib/knowledge/ingestion-pipeline";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:Knowledge");

/** POST /api/knowledge - Ingest document */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const body = await req.json();
    const { title, sourceType = "text", sourceIdentifier = "manual", text, projectId = null } = body;

    if (!title || !text) {
      return NextResponse.json({ error: "Missing title or text" }, { status: 400 });
    }

    const docId = await ingestDocument({
      userId,
      projectId,
      title,
      sourceType,
      sourceIdentifier,
      text,
    });

    return NextResponse.json({ ok: true, id: docId });
  } catch (error) {
    log.error("Failed to ingest document", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Ingestion failed" },
      { status: 500 }
    );
  }
}

/** GET /api/knowledge - List user documents */
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.KNOWLEDGE_DOCUMENTS || "knowledge_documents")
      .where("userId", "==", userId)
      .orderBy("createdAt", "desc")
      .get();

    const docs = snapshot.docs.map((doc) => doc.data());
    return NextResponse.json(docs);
  } catch (error) {
    log.error("Failed to list documents", error);
    return NextResponse.json({ error: "Listing failed" }, { status: 500 });
  }
}
