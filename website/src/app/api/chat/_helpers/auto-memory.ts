import type { Firestore } from "firebase-admin/firestore";
import {
  extractAutoMemoryCandidate,
  saveMemoryRecord,
} from "@/lib/memory-store";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ChatAutoMemory");

export async function maybeAutoSaveImportantMemory(params: {
  adminDb: Firestore;
  userId: string;
  userText: string;
  projectId?: string | null;
}) {
  const candidate = extractAutoMemoryCandidate(params.userText);
  if (!candidate) {
    return null;
  }

  try {
    return await saveMemoryRecord({
      adminDb: params.adminDb,
      userId: params.userId,
      content: candidate.content,
      memoryType: candidate.memoryType,
      importance: candidate.importance,
      tags: candidate.tags,
      projectId: params.projectId,
    });
  } catch (error) {
    log.warn("Auto-memory save skipped after failure:", error);
    return null;
  }
}
