import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { extractAutoMemoryCandidate } from "@/lib/memory-store";
import {
  hasCredentialLikeText,
  redactSensitiveMemoryText,
} from "@/lib/sensitive-memory";

const CHAT_SUMMARY_TAG = "chat-summary";
const CHAT_SUMMARY_VERSION = 1;
const MAX_SUMMARY_BULLETS = 12;
const MAX_BULLET_LENGTH = 240;

type StoredChatSummaryMemory = {
  content?: unknown;
  importance?: unknown;
  tags?: unknown;
  is_active?: unknown;
  source_chat_id?: unknown;
  project_id?: unknown;
};

type UpdateChatSummaryMemoryInput = {
  adminDb: Firestore;
  userId: string;
  chatId: string;
  projectId?: string | null;
  chatTitle?: string | null;
  userText: string;
  assistantText: string;
  sourceMessageId?: string | null;
};

type BuildRollingChatSummaryInput = {
  existingContent?: string | null;
  chatTitle?: string | null;
  userText: string;
  assistantText: string;
};

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncateText(value: string, maxLength = MAX_BULLET_LENGTH) {
  const normalized = collapseWhitespace(value);
  if (normalized.length <= maxLength) return normalized;

  const cut = normalized.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : cut.length).trim()}...`;
}

function normalizeBullet(value: string) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^\w\s:[\].-]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isSafeTag(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function mergeTags(existing: unknown, incoming: string[]) {
  const existingTags = Array.isArray(existing) ? existing.filter(isSafeTag) : [];
  return Array.from(new Set([...existingTags, ...incoming]));
}

function parseExistingBullets(content: string | null | undefined) {
  if (!content) return [];

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).trim())
    .filter(Boolean);
}

function hasAssistantOutcomeSignal(value: string) {
  return /\b(?:created|updated|saved|stored|sent|drafted|found|connected|configured|fixed|added|removed|generated|opened|started|completed|failed|blocked|unavailable|needs|next step|ready for approval)\b/i.test(
    value
  );
}

function isLowSignalUserText(value: string) {
  const normalized = collapseWhitespace(value).toLowerCase();
  return (
    normalized.length < 18 ||
    /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|cool|nice|great)[.!?]*$/.test(
      normalized
    )
  );
}

export function buildTurnSummaryBullets(params: {
  userText: string;
  assistantText: string;
}) {
  const userText = collapseWhitespace(redactSensitiveMemoryText(params.userText));
  const assistantText = collapseWhitespace(
    redactSensitiveMemoryText(params.assistantText)
  );
  const bullets: string[] = [];
  const candidate = extractAutoMemoryCandidate(userText);

  if (candidate) {
    bullets.push(`User shared: ${truncateText(candidate.content)}`);
  } else if (!isLowSignalUserText(userText)) {
    bullets.push(`User asked: ${truncateText(userText)}`);
  }

  if (hasCredentialLikeText(params.userText)) {
    bullets.push(
      "Credential-like details were discussed. Raw secrets were not stored in memory; use connected integrations or the encrypted credential vault for reuse."
    );
  }

  if (assistantText && hasAssistantOutcomeSignal(assistantText)) {
    bullets.push(`Rearvy responded: ${truncateText(assistantText)}`);
  }

  return bullets;
}

export function buildRollingChatSummary({
  existingContent,
  chatTitle,
  userText,
  assistantText,
}: BuildRollingChatSummaryInput) {
  const incoming = buildTurnSummaryBullets({ userText, assistantText });
  const existing = parseExistingBullets(existingContent);
  const seen = new Set<string>();
  const bullets: string[] = [];

  for (const bullet of [...incoming, ...existing]) {
    const sanitized = truncateText(redactSensitiveMemoryText(bullet));
    const key = normalizeBullet(sanitized);
    if (!sanitized || seen.has(key)) continue;
    seen.add(key);
    bullets.push(sanitized);
    if (bullets.length >= MAX_SUMMARY_BULLETS) break;
  }

  if (bullets.length === 0) {
    return null;
  }

  const safeTitle = chatTitle ? truncateText(redactSensitiveMemoryText(chatTitle), 80) : "";
  const heading = safeTitle
    ? `Rolling chat summary for "${safeTitle}":`
    : "Rolling chat summary:";

  return `${heading}\n${bullets.map((bullet) => `- ${bullet}`).join("\n")}`;
}

export async function maybeUpdateChatSummaryMemory({
  adminDb,
  userId,
  chatId,
  projectId,
  chatTitle,
  userText,
  assistantText,
  sourceMessageId,
}: UpdateChatSummaryMemoryInput) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.MEMORIES)
    .where("user_id", "==", userId)
    .get();

  const existingDoc = snapshot.docs.find((doc) => {
    const data = doc.data() as StoredChatSummaryMemory;
    return data.is_active !== false && data.source_chat_id === chatId;
  });
  const existing = existingDoc?.data() as StoredChatSummaryMemory | undefined;

  const content = buildRollingChatSummary({
    existingContent: typeof existing?.content === "string" ? existing.content : null,
    chatTitle,
    userText,
    assistantText,
  });

  if (!content) return null;

  const nowIso = new Date().toISOString();
  const tags = mergeTags(existing?.tags, [
    CHAT_SUMMARY_TAG,
    `chat:${chatId}`,
    ...(projectId ? [`project:${projectId}`] : []),
  ]);
  const payload = {
    user_id: userId,
    content,
    memory_type: "context",
    importance: Math.max(
      typeof existing?.importance === "number" ? existing.importance : 0,
      6
    ),
    tags,
    is_active: true,
    source_chat_id: chatId,
    source_message_id: sourceMessageId ?? null,
    managed_by: "chat_summary_auto",
    summary_version: CHAT_SUMMARY_VERSION,
    updated_at: nowIso,
    ...(projectId ? { project_id: projectId } : {}),
  };

  if (existingDoc) {
    await existingDoc.ref.update(payload);
    return { id: existingDoc.id, created: false };
  }

  const docRef = adminDb.collection(COLLECTIONS.MEMORIES).doc();
  await docRef.set({
    id: docRef.id,
    ...payload,
    created_at: nowIso,
  });

  return { id: docRef.id, created: true };
}
