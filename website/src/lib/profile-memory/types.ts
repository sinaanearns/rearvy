import type { MemoryType } from "@/types/database";

/**
 * Canonical list of every "software profile" slot we want to capture once for
 * the user. Each slot is a small, durable fact the assistant should never
 * have to re-ask for. The desktop client writes a snapshot of these slots on
 * startup (after probing the device); the chat and profile flows can also
 * upsert slots whenever the user volunteers a new fact.
 *
 * Dynamic slots (e.g. "emulator", "game_launcher") are allowed and stored
 * alongside these well-known ones. They are rendered after the well-known
 * slots in the UI, ordered alphabetically.
 */
export const PROFILE_MEMORY_SLOTS = [
  "video_editor",
  "code_editor",
  "ai_coding_assistant",
  "design_software",
  "communication",
  "productivity",
  "browser",
  "terminal",
  "music_or_audio",
  "other_software",
] as const;

/**
 * Well-known slot type for the predefined categories.
 * The system also accepts any string slot name for dynamic categories.
 */
export type WellKnownProfileMemorySlot = (typeof PROFILE_MEMORY_SLOTS)[number];

/**
 * ProfileMemorySlot accepts any string so dynamic categories (e.g. "emulator",
 * "game_launcher", "screen_recorder") discovered by the full-device scanner
 * can be stored and rendered without schema changes.
 */
export type ProfileMemorySlot = string;

export type ProfileMemoryEntry = {
  slot: ProfileMemorySlot;
  value: string;
  source: "desktop_scan" | "user_statement" | "profile_form";
  importance: number;
  tags: string[];
};

export type ProfileMemorySnapshot = {
  entries: ProfileMemoryEntry[];
  updatedAt: string;
  source: ProfileMemorySnapshotSource;
};

export type ProfileMemorySnapshotSource =
  | "desktop_scan"
  | "user_statement"
  | "profile_form"
  | "merge";

export type ProfileMemoryFact = {
  slot: ProfileMemorySlot;
  label: string;
  value: string;
  importance: number;
  tags: string[];
};

/** Human-readable labels for the well-known slots. */
export const PROFILE_MEMORY_LABELS: Record<WellKnownProfileMemorySlot, string> = {
  video_editor: "Video editor",
  code_editor: "Code editor",
  ai_coding_assistant: "AI coding assistant",
  design_software: "Design software",
  communication: "Communication app",
  productivity: "Productivity app",
  browser: "Default browser",
  terminal: "Terminal or shell",
  music_or_audio: "Music or audio tool",
  other_software: "Other software",
};

/**
 * Converts a dynamic snake_case slot name to a human-readable label.
 * For well-known slots, returns the predefined label.
 * For dynamic slots, converts snake_case to Title Case.
 * Examples:
 *   "emulator" → "Emulator"
 *   "game_launcher" → "Game launcher"
 *   "screen_recorder" → "Screen recorder"
 */
export function getLabelForSlot(slot: ProfileMemorySlot): string {
  if (isWellKnownSlot(slot)) {
    return PROFILE_MEMORY_LABELS[slot];
  }
  // Convert snake_case to Title Case for dynamic slots
  return slot
    .replace(/_/g, " ")
    .replace(/^./, (c) => c.toUpperCase());
}

export const PROFILE_MEMORY_TYPES: Record<WellKnownProfileMemorySlot, MemoryType> = {
  video_editor: "fact",
  code_editor: "fact",
  ai_coding_assistant: "fact",
  design_software: "fact",
  communication: "fact",
  productivity: "fact",
  browser: "fact",
  terminal: "fact",
  music_or_audio: "fact",
  other_software: "fact",
};

export const PROFILE_MEMORY_TAG_PREFIX = "profile-slot";

export function isWellKnownSlot(value: unknown): value is WellKnownProfileMemorySlot {
  return (
    typeof value === "string" &&
    (PROFILE_MEMORY_SLOTS as readonly string[]).includes(value)
  );
}

/**
 * @deprecated Use isWellKnownSlot() instead. This function now also accepts
 * dynamic slot names (any non-empty snake_case string) to support full-device
 * scanning. Kept for backward compatibility.
 */
export function isProfileMemorySlot(value: unknown): value is ProfileMemorySlot {
  return typeof value === "string" && value.trim().length > 0;
}

export function getProfileMemoryTagForSlot(slot: ProfileMemorySlot) {
  return `${PROFILE_MEMORY_TAG_PREFIX}:${slot}`;
}

/**
 * Validates whether a dynamic slot name is safe to store.
 * Slot names must be non-empty strings of letters, digits, and underscores.
 * Max 64 characters.
 */
export function isValidSlotName(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[a-z][a-z0-9_]{0,63}$/.test(value)
  );
}
