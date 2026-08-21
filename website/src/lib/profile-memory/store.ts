import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { hasCredentialLikeText, redactSensitiveMemoryText } from "@/lib/sensitive-memory";
import { createServerLogger } from "@/lib/server-logger";
import { saveMemoryRecord } from "@/lib/memory-store";
import { getProfileMemoryTagForSlot, type ProfileMemoryEntry, type ProfileMemoryFact, type ProfileMemorySlot } from "./types";

const log = createServerLogger("ProfileMemoryStore");

export const PROFILE_MEMORY_DOC_ID = "device-software";

export type ProfileMemoryDoc = {
  entries: ProfileMemoryFact[];
  updated_at: string;
  source: "desktop_scan" | "user_statement" | "profile_form" | "merge";
};

function isProfileMemoryFact(value: unknown): value is ProfileMemoryFact {
  if (!value || typeof value !== "object") return false;
  const fact = value as Record<string, unknown>;
  return (
    typeof fact.slot === "string" &&
    typeof fact.label === "string" &&
    typeof fact.value === "string" &&
    typeof fact.importance === "number" &&
    Array.isArray(fact.tags)
  );
}

function readProfileMemoryDoc(raw: unknown): ProfileMemoryDoc {
  if (!raw || typeof raw !== "object") {
    return { entries: [], updated_at: new Date(0).toISOString(), source: "merge" };
  }
  const data = raw as Record<string, unknown>;
  const entries = Array.isArray(data.entries) ? data.entries.filter(isProfileMemoryFact) : [];
  const updatedAt = typeof data.updated_at === "string" ? data.updated_at : new Date(0).toISOString();
  const source: ProfileMemoryDoc["source"] =
    data.source === "desktop_scan" || data.source === "user_statement" || data.source === "profile_form"
      ? data.source
      : "merge";
  return { entries, updated_at: updatedAt, source };
}

/**
 * Reads the persistent device + software profile memory for a user. Returns
 * an empty snapshot if no document exists yet.
 */
export async function readProfileMemory(adminDb: Firestore, userId: string): Promise<ProfileMemoryDoc> {
  const ref = adminDb.collection(COLLECTIONS.MEMORIES).doc(`${userId}_${PROFILE_MEMORY_DOC_ID}`);
  const snap = await ref.get();
  if (!snap.exists) {
    return { entries: [], updated_at: new Date(0).toISOString(), source: "merge" };
  }
  return readProfileMemoryDoc(snap.data());
}

export type PersistProfileMemoryInput = {
  adminDb: Firestore;
  userId: string;
  entries: ProfileMemoryEntry[];
  source?: ProfileMemoryDoc["source"];
};

/**
 * Persists the merged profile memory snapshot. Returns the final entries and
 * the list of slots that changed. Sensitive-looking values (passwords, tokens)
 * are filtered out before they are written.
 */
export async function persistProfileMemory(input: PersistProfileMemoryInput) {
  const ref = input.adminDb.collection(COLLECTIONS.MEMORIES).doc(`${input.userId}_${PROFILE_MEMORY_DOC_ID}`);
  const existing = await readProfileMemory(input.adminDb, input.userId);

  const { mergeProfileMemoryEntries } = await import("./extractor");
  const { snapshot, added, upgraded } = mergeProfileMemoryEntries(
    existing.entries,
    input.entries.filter((entry) => !hasCredentialLikeText(entry.value))
  );

  const now = new Date().toISOString();
  const payload: ProfileMemoryDoc = {
    entries: snapshot,
    updated_at: now,
    source: input.source ?? existing.source ?? "merge",
  };

  await ref.set(payload, { merge: true });

  return {
    entries: snapshot,
    added,
    upgraded,
    updated_at: now,
  };
}

function buildMemoryContent(fact: ProfileMemoryFact) {
  const value = redactSensitiveMemoryText(fact.value);
  return `Profile: ${fact.label} = ${value}`;
}

/**
 * Mirrors the structured profile-memory snapshot into the standard
 * {@link COLLECTIONS.MEMORIES} records. This is what powers "save the user's
 * software stack" in chat, the desktop prompt, and the system prompt. Each
 * fact becomes a memory document with a stable tag, so the chat route can
 * promote it into the prompt and deduplicate it automatically.
 */
export async function mirrorProfileMemoryToFirestore(params: {
  adminDb: Firestore;
  userId: string;
  projectId?: string | null;
  snapshot: ProfileMemoryFact[];
}) {
  const results: Array<{ slot: ProfileMemorySlot; id: string; created: boolean }> = [];

  for (const fact of params.snapshot) {
    if (hasCredentialLikeText(fact.value)) {
      log.warn("Skipping profile-memory mirror due to credential-like value", {
        slot: fact.slot,
      });
      continue;
    }
    const content = buildMemoryContent(fact);
    if (!content.trim()) continue;
    try {
      const result = await saveMemoryRecord({
        adminDb: params.adminDb,
        userId: params.userId,
        content,
        memoryType: "fact",
        importance: fact.importance,
        tags: [getProfileMemoryTagForSlot(fact.slot), ...fact.tags],
        projectId: params.projectId,
      });
      results.push({ slot: fact.slot, id: result.id, created: result.created });
    } catch (error) {
      log.warn("Failed to mirror profile-memory fact to Firestore:", error);
    }
  }

  return results;
}
