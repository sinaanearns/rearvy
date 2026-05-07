export const LEGACY_SYSTEM_CHAT_TYPES = [
  "rearvy_chat",
  "rearvy_important",
] as const;

export type LegacySystemChatType = (typeof LEGACY_SYSTEM_CHAT_TYPES)[number];

const legacySystemChatTypeSet = new Set<string>(LEGACY_SYSTEM_CHAT_TYPES);
const legacySystemChatTitleSet = new Set(["Rearvy Chat", "Rearvy Important"]);

export function isLegacySystemChat(chat: {
  system_chat_type?: unknown;
  title?: unknown;
}) {
  const systemChatType =
    typeof chat.system_chat_type === "string" ? chat.system_chat_type : null;

  if (systemChatType && legacySystemChatTypeSet.has(systemChatType)) {
    return true;
  }

  const title = typeof chat.title === "string" ? chat.title.trim() : "";
  return legacySystemChatTitleSet.has(title);
}
