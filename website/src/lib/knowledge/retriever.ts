import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getEmbedding } from "./embedder";
import type { KnowledgeChunk } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Knowledge:Retriever");

export interface RetrievalResult {
  chunk: KnowledgeChunk;
  similarity: number;
}

/** Calculates cosine similarity between two numeric vectors. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Searches the Knowledge Base using vector embeddings.
 * Enforces strict multi-tenant constraints (userId must match).
 */
export async function retrieveKnowledge(params: {
  userId: string;
  query: string;
  projectId?: string | null;
  limit?: number;
}): Promise<RetrievalResult[]> {
  const { userId, query, projectId = null, limit = 5 } = params;

  log.info(`Retrieving knowledge for user ${userId}, query: "${query}"`);

  // 1. Generate query embedding
  const queryVector = await getEmbedding(query);
  const isAllZeros = queryVector.every((x) => x === 0);
  if (isAllZeros) {
    log.warn("Query vector is all zeros. Skipping vector search.");
    return [];
  }

  // 2. Fetch user's chunks from Firestore
  let baseQuery = adminDb
    .collection(COLLECTIONS.KNOWLEDGE_CHUNKS || "knowledge_chunks")
    .where("userId", "==", userId);

  if (projectId) {
    baseQuery = baseQuery.where("projectId", "==", projectId);
  }

  const snapshot = await baseQuery.get();
  const chunks = snapshot.docs.map((doc) => doc.data() as KnowledgeChunk);

  // 3. Compute similarities
  const results: RetrievalResult[] = chunks
    .map((chunk) => {
      const similarity = cosineSimilarity(queryVector, chunk.embedding);
      return { chunk, similarity };
    })
    .sort((a, b) => b.similarity - a.similarity);

  // Return top K matches
  const slice = results.slice(0, limit);
  log.info(`Found ${slice.length} matching knowledge chunks.`);
  return slice;
}
