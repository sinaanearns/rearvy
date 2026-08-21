import type { Firestore } from "firebase-admin/firestore";
import type { MemoryType } from "@/types/database";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { hasCredentialLikeText, redactSensitiveMemoryText } from "@/lib/sensitive-memory";

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

export function isTaskOrLogText(text: string | null | undefined): boolean {
  if (!text || typeof text !== "string") return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();

  if (
    lower.includes("browser task") ||
    lower.includes("browser workflow") ||
    lower.includes("desktop workflow") ||
    lower.includes("finished with status:") ||
    lower.includes("execution log:") ||
    lower.includes("report the outcome of the browser task") ||
    lower.includes("drive failed:") ||
    lower.includes("reached maximum steps") ||
    lower.includes("reinitialize_browser") ||
    lower.includes("rate limit exceeded") ||
    lower.includes("pause: user credentials required") ||
    lower.includes("when the signup or login succeeds, immediately call savememory") ||
    lower.includes("act as maria's browser operator") ||
    lower.includes("[redacted_secret]") ||
    lower.includes("page title:") ||
    lower.includes("current url:") ||
    lower.includes("open shopify at https") ||
    lower.includes("scan the full page text") ||
    lower.includes("summarize what maria") ||
    lower.includes("timed out finding ui element") ||
    lower.includes("no visible ui element matched") ||
    lower.includes("do not claim anything beyond the provided browser evidence") ||
    lower.includes("browser evidence log:")
  ) {
    return true;
  }

  if (
    trimmed.length > 200 &&
    (lower.includes("task:") || lower.includes("summary:") || lower.includes("progress made:"))
  ) {
    return true;
  }

  return false;
}

export function condenseMemoryText(content: string): string {
  if (!content) return "";
  let clean = collapseWhitespace(content);

  // Strip conversational preamble
  clean = clean
    .replace(/^(?:please\s+)?(?:remember\s+that|remember|don't\s+forget\s+that|don't\s+forget|note\s+that|just\s+so\s+you\s+know|for\s+context|i\s+wanted\s+to\s+(?:let\s+you\s+know|tell\s+you)\s+that|fyi)\s*[:,-]?\s*/i, "")
    .trim();

  // If memory is credential-like or login related, extract concise key-value notation
  const lower = clean.toLowerCase();
  if (hasCredentialLikeText(clean) || /\b(?:login|signup|password|account|credential)\b/i.test(clean)) {
    const siteMatch = clean.match(/\b(?:site|website|domain|for|at|on)\s+([a-z0-9.-]+\.[a-z]{2,}|[a-z0-9_-]{3,})\b/i);
    const emailMatch = clean.match(/\b([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})\b/i) || clean.match(/\b(?:email|user|username)\s+([^\s,;:]+)/i);

    const siteStr = siteMatch ? siteMatch[1] : "";
    const emailStr = emailMatch ? emailMatch[1] : "";

    if (siteStr || emailStr) {
      const sitePart = siteStr ? `Site: ${siteStr}` : "";
      const emailPart = emailStr ? `User: ${emailStr}` : "";
      const notePart = lower.includes("password") ? "Password set by user" : "Credential noted";
      return [sitePart, emailPart, notePart].filter(Boolean).join(" | ");
    }
  }

  // General condensation: trim if over 160 chars and keep first clause
  if (clean.length > 160) {
    const periodIndex = clean.indexOf(".");
    if (periodIndex > 20 && periodIndex < 160) {
      clean = clean.slice(0, periodIndex).trim();
    } else {
      clean = clean.slice(0, 160).trim().replace(/[,:;-\s]+$/, "");
    }
  }

  return clean;
}

export function extractAutoMemoryCandidate(
  userText: string
): AutoMemoryCandidate | null {
  if (isTaskOrLogText(userText)) {
    return null;
  }

  const normalized = collapseWhitespace(userText);
  if (!normalized) {
    return null;
  }

  const focused = condenseMemoryText(trimAtRequestBoundary(normalized));
  if (!focused || focused.length < 3) {
    return null;
  }
  const lower = normalized.toLowerCase();

  const identityCorrection =
    /\b(?:you got it wrong|that's wrong|actually|correction|for context|just so you know)\b/.test(
      lower
    ) && /\b(?:my name is|i am|i'm)\b/.test(lower);

  if (hasCredentialLikeText(normalized)) {
    return {
      content: focused,
      memoryType: "context",
      importance: 8,
      tags: ["credential", "sensitive"],
    };
  }

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

  if (/\b(?:my name is|i am called|you can call me)\b/.test(lower)) {
    return {
      content: focused,
      memoryType: "context",
      importance: 7,
      tags: ["identity", "name"],
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

  if (/(?:phone|mobile|email|contact|client|employee)\b/.test(lower)) {
    return { content: focused, memoryType: "fact", importance: 7, tags: ["contact"] };
  }

  if (/(?:meeting|appointment|calendar|schedule|deadline)\b/.test(lower)) {
    return { content: focused, memoryType: "context", importance: 6, tags: ["calendar"] };
  }

  if (/(?:invoice|revenue|finance|company|business)\b/.test(lower)) {
    return { content: focused, memoryType: "context", importance: 6, tags: ["business"] };
  }

  if (/(?:research|competitor|finding|study)\b/.test(lower)) {
    return { content: focused, memoryType: "context", importance: 5, tags: ["research"] };
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
  if (isTaskOrLogText(content)) {
    throw new Error("Cannot save task execution log to memory");
  }

  const condensedContent = condenseMemoryText(content);
  const trimmedContent = collapseWhitespace(redactSensitiveMemoryText(condensedContent || content));
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
