/**
 * Types for Knowledge Base / RAG Pipeline
 */

export interface KnowledgeDocument {
  id: string;
  userId: string;
  projectId: string | null;
  title: string;
  sourceType: "file" | "url" | "text";
  sourceIdentifier: string; // File name or URL
  mimeType?: string;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  documentId: string;
  userId: string;
  projectId: string | null;
  text: string;
  embedding: number[]; // Vector representation
  chunkIndex: number;
}
