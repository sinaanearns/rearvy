import type { Firestore } from "firebase-admin/firestore";
import type { MemoryType } from "@/types/database";
import { COLLECTIONS } from "@/lib/firebase/schema";

type PersistMemoryInput = {
  adminDb: Firestore;
  userId: string;
  content: string;
  memoryType: Exclude<MemoryType, "persona">;
  importance?: number;
  tags?: string[];
  projectId?: string | null;
};

type StoredMemoryRecord = {
  content?: string;
  importance?: number | null;
  tags?: string[] | null;
  project_id?: string | null;
  is_active?: boolean;
};

export type AutoMemoryCandidate = {
  content: string;
  memoryType: Exclude<MemoryType, "persona">;
  importance: number;
  tags: string[];
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function normalizeMemoryContent(content: string) {
  return collapseWhitespace(content).toLowerCase();
}

function mergeTags(existing: string[] | null | undefined, incoming: string[]) {
  return Array.from(
    new Set(
      [...(existing || []), ...incoming]
        .map((tag) => collapseWhitespace(tag))
        .filter(Boolean)
    )
  );
}

function sameProjectScope(
  leftProjectId: string | null | undefined,
  rightProjectId: string | null | undefined
) {
  return (leftProjectId ?? null) === (rightProjectId ?? null);
}

function trimAtRequestBoundary(content: string) {
  const boundaries = [
    /\bi just wanted to\b/i,
    /\bi wanted to know\b/i,
    /\bcan you\b/i,
    /\bcould you\b/i,
    /\bwhat do you think\b/i,
    /\bwhat should\b/i,
    /\bhelp me\b/i,
  ];

  let endIndex = content.length;
  for (const pattern of boundaries) {
    const matchIndex = content.search(pattern);
    if (matchIndex >= 0) {
      endIndex = Math.min(endIndex, matchIndex);
    }
  }

  const questionIndex = content.indexOf("?");
  if (questionIndex >= 0) {
    endIndex = Math.min(endIndex, questionIndex);
  }

  const trimmed = content.slice(0, endIndex).trim().replace(/[,:;-\s]+$/, "");
  return trimmed.length >= 12 ? trimmed : content;
}

export function extractAutoMemoryCandidate(
  userText: string
): AutoMemoryCandidate | null {
  const normalized = collapseWhitespace(userText);
  if (!normalized) {
    return null;
  }

  const focused = trimAtRequestBoundary(normalized);
  const lower = normalized.toLowerCase();

  const identityCorrection =
    /\b(?:you got it wrong|that's wrong|actually|correction|for context|just so you know)\b/.test(
      lower
    ) && /\b(?:my name is|i am|i'm)\b/.test(lower);

  if (identityCorrection) {
    return {
      content: focused,
      memoryType: "context",
      importance: 9,
      tags: ["correction", "identity"],
    };
  }

  if (
    /\b(?:my name is|i am|i'm)\b/.test(lower) &&
    /\b(?:developer|founder|owner|creator|ceo|boss)\b/.test(lower)
  ) {
    return {
      content: focused,
      memoryType: "context",
      importance: 8,
      tags: ["identity", "role"],
    };
  }

  if (/\b(?:remember|don't forget|important)\b/.test(lower)) {
    const memoryType = /\bi prefer\b/.test(lower)
      ? "preference"
      : /\bgoal\b/.test(lower)
        ? "goal"
        : /\b(?:decided|decision)\b/.test(lower)
          ? "decision"
          : "context";

    return {
      content: focused,
      memoryType,
      importance: 8,
      tags: ["explicit-memory"],
    };
  }

  if (/\bi prefer\b/.test(lower)) {
    return {
      content: focused,
      memoryType: "preference",
      importance: 7,
      tags: ["preference"],
    };
  }

  if (
    /\b(?:i am building|i'm building|we are building|we're building|my goal is|our goal is)\b/.test(
      lower
    )
  ) {
    return {
      content: focused,
      memoryType: "goal",
      importance: 7,
      tags: ["goal", "product-context"],
    };
  }

  return null;
}

export async function saveMemoryRecord({
  adminDb,
  userId,
  content,
  memoryType,
  importance = 5,
  tags = [],
  projectId,
}: PersistMemoryInput) {
  const trimmedContent = collapseWhitespace(content);
  if (!trimmedContent) {
    throw new Error("Memory content is required");
  }

  const normalizedContent = normalizeMemoryContent(trimmedContent);
  const incomingTags = mergeTags([], tags);
  const snapshot = await adminDb
    .collection(COLLECTIONS.MEMORIES)
    .where("user_id", "==", userId)
    .get();

  const existingDoc = snapshot.docs.find((doc) => {
    const data = doc.data() as StoredMemoryRecord;
    return (
      data.is_active !== false &&
      sameProjectScope(data.project_id, projectId) &&
      typeof data.content === "string" &&
      normalizeMemoryContent(data.content) === normalizedContent
    );
  });

  const timestamp = new Date().toISOString();

  if (existingDoc) {
    const existing = existingDoc.data() as StoredMemoryRecord;
    await existingDoc.ref.update({
      importance: Math.max(Number(existing.importance ?? 0), importance),
      tags: mergeTags(existing.tags, incomingTags),
      is_active: true,
      updated_at: timestamp,
    });

    return { id: existingDoc.id, created: false };
  }

  const docRef = adminDb.collection(COLLECTIONS.MEMORIES).doc();
  await docRef.set({
    id: docRef.id,
    user_id: userId,
    content: trimmedContent,
    memory_type: memoryType,
    importance,
    tags: incomingTags,
    is_active: true,
    created_at: timestamp,
    updated_at: timestamp,
    ...(projectId ? { project_id: projectId } : {}),
  });

  return { id: docRef.id, created: true };
}
