import type { Firestore } from "firebase-admin/firestore";
import {
  extractAutoMemoryCandidate,
  isTaskOrLogText,
  saveMemoryRecord,
} from "@/lib/memory-store";
import { saveFileMemory } from "@/lib/filesystem-memory";
import { extractProfileMemoryEntries } from "@/lib/profile-memory/extractor";
import {
  persistProfileMemory,
  mirrorProfileMemoryToFirestore,
} from "@/lib/profile-memory/store";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("ChatAutoMemory");

export async function maybeAutoSaveImportantMemory(params: {
  adminDb: Firestore;
  userId: string;
  userText: string;
  projectId?: string | null;
}) {
  if (isTaskOrLogText(params.userText)) {
    return null;
  }

  const candidate = extractAutoMemoryCandidate(params.userText);
  const profileEntries = extractProfileMemoryEntries(params.userText);
  const hasProfileEntries = profileEntries.length > 0;

  if (!candidate && !hasProfileEntries) {
    return null;
  }

  try {
    const tasks: Array<Promise<unknown>> = [];

    if (candidate) {
      tasks.push(
        Promise.all([
          saveMemoryRecord({
            adminDb: params.adminDb,
            userId: params.userId,
            content: candidate.content,
            memoryType: candidate.memoryType,
            importance: candidate.importance,
            tags: candidate.tags,
            projectId: params.projectId,
          }),
          saveFileMemory({
            userId: params.userId,
            content: params.userText,
            projectId: params.projectId,
            tags: candidate.tags,
          }),
        ])
      );
    }

    if (hasProfileEntries) {
      tasks.push(
        (async () => {
          try {
            const persisted = await persistProfileMemory({
              adminDb: params.adminDb,
              userId: params.userId,
              entries: profileEntries,
              source: "user_statement",
            });
            await mirrorProfileMemoryToFirestore({
              adminDb: params.adminDb,
              userId: params.userId,
              projectId: params.projectId,
              snapshot: persisted.entries,
            });
          } catch (error) {
            log.warn("Profile-memory auto-save skipped:", error);
          }
        })()
      );
    }

    const results = await Promise.all(tasks);
    const firestoreResult = candidate ? results[0] : null;
    return Array.isArray(firestoreResult) ? firestoreResult[0] : null;
  } catch (error) {
    log.warn("Auto-memory save skipped after failure:", error);
    return null;
  }
}
