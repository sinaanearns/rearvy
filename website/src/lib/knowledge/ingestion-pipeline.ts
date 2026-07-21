import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { splitTextIntoChunks } from "./chunker";
import { getEmbedding } from "./embedder";
import type { KnowledgeDocument, KnowledgeChunk } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Knowledge:IngestionPipeline");

export interface IngestDocumentOptions {
  userId: string;
  projectId?: string | null;
  title: string;
  sourceType: "file" | "url" | "text";
  sourceIdentifier: string;
  text: string;
  mimeType?: string;
}

/**
 * Ingests a new document into the RAG vector store.
 * Splits text into chunks, generates vector embeddings, and stores in Firestore.
 */
export async function ingestDocument(options: IngestDocumentOptions): Promise<string> {
  const {
    userId,
    projectId = null,
    title,
    sourceType,
    sourceIdentifier,
    text,
    mimeType = "text/plain",
  } = options;

  log.info(`Starting ingestion for document "${title}" (${text.length} chars)`);

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  // 1. Create Document record
  const docRef = adminDb.collection(COLLECTIONS.KNOWLEDGE_DOCUMENTS || "knowledge_documents").doc();
  const knowledgeDoc: KnowledgeDocument = {
    id: docRef.id,
    userId,
    projectId,
    title,
    sourceType,
    sourceIdentifier,
    mimeType,
    createdAt: now,
    updatedAt: now,
  };

  batch.set(docRef, knowledgeDoc);

  // 2. Chunk text
  const textChunks = splitTextIntoChunks(text);
  log.info(`Document split into ${textChunks.length} chunks.`);

  // 3. Embed & Write chunks
  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];
    const embedding = await getEmbedding(chunkText, "passage");
    if (!embedding) {
      throw new Error(
        "Knowledge ingestion stopped because a valid embedding could not be generated. Check NVIDIA embedding configuration."
      );
    }

    const chunkRef = adminDb.collection(COLLECTIONS.KNOWLEDGE_CHUNKS || "knowledge_chunks").doc();
    const knowledgeChunk: KnowledgeChunk = {
      id: chunkRef.id,
      documentId: docRef.id,
      userId,
      projectId,
      text: chunkText,
      embedding,
      chunkIndex: i,
    };

    batch.set(chunkRef, knowledgeChunk);
  }

  // 4. Commit Firestore batch
  await batch.commit();
  log.info(`Ingestion complete for document ${docRef.id}. Total chunks stored: ${textChunks.length}`);
  return docRef.id;
}
