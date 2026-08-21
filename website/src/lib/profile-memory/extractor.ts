import { isTaskOrLogText } from "@/lib/memory-store";
import {
  getProfileMemoryTagForSlot,
  getLabelForSlot,
  isProfileMemorySlot,
  isValidSlotName,
  PROFILE_MEMORY_LABELS,
  PROFILE_MEMORY_TYPES,
  type ProfileMemoryEntry,
  type ProfileMemoryFact,
  type ProfileMemorySlot,
} from "./types";

/**
 * Lexicon of well-known products mapped to the slot they best fill. Keys are
 * normalized with `normalizeToolKey`, so case and whitespace do not matter.
 * Aliases (e.g. "vscode" / "code --") collapse to the same entry.
 */
const KNOWN_SOFTWARE: ReadonlyArray<{
  pattern: RegExp;
  slot: ProfileMemorySlot;
  display: string;
  importance: number;
}> = [
  // Video editing
  { pattern: /davinci[\s-]?resolve/i, slot: "video_editor", display: "DaVinci Resolve", importance: 9 },
  { pattern: /\badobe\s*premiere\b/i, slot: "video_editor", display: "Adobe Premiere Pro", importance: 9 },
  { pattern: /\bfinal\s*cut\b/i, slot: "video_editor", display: "Final Cut Pro", importance: 9 },
  { pattern: /\bcapcut\b/i, slot: "video_editor", display: "CapCut", importance: 7 },
  { pattern: /\bfilmora\b/i, slot: "video_editor", display: "Filmora", importance: 7 },
  { pattern: /\bvegas\s*pro\b/i, slot: "video_editor", display: "Vegas Pro", importance: 7 },

  // Code editors
  { pattern: /\bvs\s*code\b|visual\s*studio\s*code|\bvscode\b/i, slot: "code_editor", display: "VS Code", importance: 9 },
  { pattern: /\bwebstorm\b/i, slot: "code_editor", display: "WebStorm", importance: 8 },
  { pattern: /\bintellij\b/i, slot: "code_editor", display: "IntelliJ IDEA", importance: 8 },
  { pattern: /\bpycharm\b/i, slot: "code_editor", display: "PyCharm", importance: 8 },
  { pattern: /\bsublime\s*text\b/i, slot: "code_editor", display: "Sublime Text", importance: 7 },
  { pattern: /\batom\b/i, slot: "code_editor", display: "Atom", importance: 7 },
  { pattern: /\bnotepad\+\+\b/i, slot: "code_editor", display: "Notepad++", importance: 7 },

  // AI coding assistants
  { pattern: /\bcodex\b/i, slot: "ai_coding_assistant", display: "Codex", importance: 9 },
  { pattern: /\bcursor\b/i, slot: "ai_coding_assistant", display: "Cursor", importance: 9 },
  { pattern: /\bcopilot\b/i, slot: "ai_coding_assistant", display: "GitHub Copilot", importance: 8 },
  { pattern: /\bclaude\s*code\b/i, slot: "ai_coding_assistant", display: "Claude Code", importance: 8 },
  { pattern: /\bcontinue\.dev\b|\bcontinue\s*dev\b/i, slot: "ai_coding_assistant", display: "Continue.dev", importance: 7 },
  { pattern: /\btabnine\b/i, slot: "ai_coding_assistant", display: "Tabnine", importance: 7 },
  { pattern: /\bjetbrains\s*ai\b/i, slot: "ai_coding_assistant", display: "JetBrains AI", importance: 7 },

  // Design
  { pattern: /\bfigma\b/i, slot: "design_software", display: "Figma", importance: 8 },
  { pattern: /\bsketch\b/i, slot: "design_software", display: "Sketch", importance: 7 },
  { pattern: /\bphotoshop\b/i, slot: "design_software", display: "Adobe Photoshop", importance: 8 },
  { pattern: /\billustrator\b/i, slot: "design_software", display: "Adobe Illustrator", importance: 7 },
  { pattern: /\bcanva\b/i, slot: "design_software", display: "Canva", importance: 6 },
  { pattern: /\baffinity\b/i, slot: "design_software", display: "Affinity", importance: 6 },

  // Communication
  { pattern: /\bslack\b/i, slot: "communication", display: "Slack", importance: 7 },
  { pattern: /\bmicrosoft\s*teams\b|\bms\s*teams\b/i, slot: "communication", display: "Microsoft Teams", importance: 7 },
  { pattern: /\bdiscord\b/i, slot: "communication", display: "Discord", importance: 7 },
  { pattern: /\bzoom\b/i, slot: "communication", display: "Zoom", importance: 7 },
  { pattern: /\bwhatsapp\b/i, slot: "communication", display: "WhatsApp", importance: 6 },
  { pattern: /\btelegram\b/i, slot: "communication", display: "Telegram", importance: 6 },

  // Productivity
  { pattern: /\bnotion\b/i, slot: "productivity", display: "Notion", importance: 8 },
  { pattern: /\bobsidian\b/i, slot: "productivity", display: "Obsidian", importance: 7 },
  { pattern: /\bgoogle\s*docs\b/i, slot: "productivity", display: "Google Docs", importance: 7 },
  { pattern: /\bms\s*word|microsoft\s*word\b/i, slot: "productivity", display: "Microsoft Word", importance: 6 },
  { pattern: /\bms\s*excel|microsoft\s*excel\b/i, slot: "productivity", display: "Microsoft Excel", importance: 6 },
  { pattern: /\bgoogle\s*sheets\b/i, slot: "productivity", display: "Google Sheets", importance: 6 },
  { pattern: /\bairtable\b/i, slot: "productivity", display: "Airtable", importance: 6 },

  // Browsers
  { pattern: /\bgoogle\s*chrome\b|\bchrome\b/i, slot: "browser", display: "Google Chrome", importance: 7 },
  { pattern: /\bmicrosoft\s*edge\b|\bedge\b/i, slot: "browser", display: "Microsoft Edge", importance: 7 },
  { pattern: /\bmozilla\s*firefox\b|\bfirefox\b/i, slot: "browser", display: "Firefox", importance: 7 },
  { pattern: /\bbrave\b/i, slot: "browser", display: "Brave", importance: 6 },
  { pattern: /\barc\b/i, slot: "browser", display: "Arc", importance: 6 },
  { pattern: /\bsafari\b/i, slot: "browser", display: "Safari", importance: 7 },

  // Terminal / shell
  { pattern: /\bwindows\s*terminal\b/i, slot: "terminal", display: "Windows Terminal", importance: 7 },
  { pattern: /\bpowershell\b/i, slot: "terminal", display: "PowerShell", importance: 7 },
  { pattern: /\bcommand\s*prompt\b|\bcmd\.exe\b/i, slot: "terminal", display: "Command Prompt", importance: 6 },
  { pattern: /\bi?term2?\b/i, slot: "terminal", display: "iTerm2", importance: 6 },
  { pattern: /\bwarp\b/i, slot: "terminal", display: "Warp", importance: 6 },

  // Music / audio
  { pattern: /\bspotify\b/i, slot: "music_or_audio", display: "Spotify", importance: 6 },
  { pattern: /\bapple\s*music\b/i, slot: "music_or_audio", display: "Apple Music", importance: 6 },
  { pattern: /\baudacity\b/i, slot: "music_or_audio", display: "Audacity", importance: 7 },
  { pattern: /\badobe\s*audition\b/i, slot: "music_or_audio", display: "Adobe Audition", importance: 7 },
];

const SLOT_PREFERENCE_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  slot: ProfileMemorySlot;
}> = [
  { pattern: /\b(?:my|i use)\s+video\s*editor\s+is\b/i, slot: "video_editor" },
  { pattern: /\b(?:my|i use)\s+code\s*editor\s+is\b/i, slot: "code_editor" },
  { pattern: /\b(?:my|i use)\s+ai\s*coding\s*assistant\s+is\b/i, slot: "ai_coding_assistant" },
  { pattern: /\b(?:my|i use)\s+design\s*(?:app|software|tool)\s+is\b/i, slot: "design_software" },
  { pattern: /\b(?:my|i use)\s+communication\s*(?:app|tool)\s+is\b/i, slot: "communication" },
  { pattern: /\b(?:my|i use)\s+productivity\s*(?:app|tool)\s+is\b/i, slot: "productivity" },
  { pattern: /\b(?:my|i use)\s+(?:default\s+)?browser\s+is\b/i, slot: "browser" },
  { pattern: /\b(?:my|i use)\s+terminal\s+is\b/i, slot: "terminal" },
  { pattern: /\b(?:my|i use)\s+(?:music|audio)\s*(?:app|tool|software)\s+is\b/i, slot: "music_or_audio" },
];

const SOFTWARE_NAME_STOPWORDS = new Set([
  "my",
  "i",
  "use",
  "is",
  "are",
  "am",
  "the",
  "a",
  "an",
  "for",
  "to",
  "and",
  "or",
  "with",
  "on",
  "of",
  "default",
  "primary",
  "main",
]);

function collapseWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeToolKey(value: string) {
  return collapseWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function stripSurroundingPunctuation(value: string) {
  return collapseWhitespace(value).replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "");
}

function splitToolNames(value: string): string[] {
  const trimmed = stripSurroundingPunctuation(value);
  if (!trimmed) return [];
  return trimmed
    .split(/,|;|\band\b|\bor\b|\/|\+/i)
    .map((part) => stripSurroundingPunctuation(part))
    .filter(Boolean);
}

function cleanValue(value: string) {
  const cleaned = collapseWhitespace(value)
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+(?:please|pls|thanks|thank you)$/i, "")
    .trim();
  return cleaned;
}

function pickLabelFromName(value: string) {
  const words = value
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part && !SOFTWARE_NAME_STOPWORDS.has(part.toLowerCase()));
  if (words.length === 0) {
    return value.trim();
  }
  return words.join(" ");
}

function pushSlotValue(
  acc: Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>,
  slot: ProfileMemorySlot,
  rawValue: string,
  source: ProfileMemoryEntry["source"],
  importance: number,
  extraTags: string[] = []
) {
  const display = pickLabelFromName(rawValue);
  const value = cleanValue(display);
  if (!value) return;

  const normalized = normalizeToolKey(value);
  if (!normalized) return;

  const bucket = acc.get(slot) ?? new Map<string, ProfileMemoryEntry>();
  const existing = bucket.get(normalized);
  if (existing) {
    bucket.set(normalized, {
      ...existing,
      importance: Math.max(existing.importance, importance),
      tags: Array.from(new Set([...existing.tags, ...extraTags])),
    });
  } else {
    bucket.set(normalized, {
      slot,
      value,
      source,
      importance,
      tags: Array.from(new Set(extraTags)),
    });
  }
  acc.set(slot, bucket);
}

function pushKnownEntry(
  acc: Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>,
  slot: ProfileMemorySlot,
  display: string,
  source: ProfileMemoryEntry["source"],
  importance: number
) {
  pushSlotValue(acc, slot, display, source, importance, ["known-software"]);
}

function mergeUserValueIntoKnown(
  acc: Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>,
  slot: ProfileMemorySlot,
  display: string,
  importance: number
) {
  const key = normalizeToolKey(display);
  const bucket = acc.get(slot) ?? new Map<string, ProfileMemoryEntry>();
  const existing = bucket.get(key);
  if (existing) {
    bucket.set(key, {
      ...existing,
      importance: Math.max(existing.importance, importance),
      tags: Array.from(new Set([...existing.tags, "user-confirmed"])),
      source: "user_statement",
    });
  } else {
    bucket.set(key, {
      slot,
      value: display,
      source: "user_statement",
      importance,
      tags: ["user-confirmed"],
    });
  }
  acc.set(slot, bucket);
}

function matchKnownSoftware(token: string) {
  for (const entry of KNOWN_SOFTWARE) {
    if (entry.pattern.test(token)) {
      return entry;
    }
  }
  return null;
}

function captureGenericSoftware(
  acc: Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>,
  slot: ProfileMemorySlot,
  rawValue: string,
  source: ProfileMemoryEntry["source"],
  importance: number
) {
  const names = splitToolNames(rawValue);
  for (const name of names) {
    if (name.length < 2) continue;
    if (SOFTWARE_NAME_STOPWORDS.has(name.toLowerCase())) continue;
    pushSlotValue(acc, slot, name, source, importance, ["user-stated"]);
  }
}

function captureFromFreeText(
  acc: Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>,
  text: string,
  source: ProfileMemoryEntry["source"],
  importance: number
) {
  if (!text) return;
  const cleaned = collapseWhitespace(text);
  if (!cleaned) return;

  // 1. Direct slot preferences: "my code editor is VS Code"
  for (const { pattern, slot } of SLOT_PREFERENCE_PATTERNS) {
    const match = cleaned.match(pattern);
    if (!match || typeof match.index !== "number") continue;
    const tail = cleaned.slice(match.index + match[0].length);
    if (!tail) continue;
    const names = splitToolNames(tail);
    for (const name of names) {
      const known = matchKnownSoftware(name);
      if (known) {
        mergeUserValueIntoKnown(acc, known.slot, known.display, Math.max(importance, known.importance));
      } else {
        pushSlotValue(acc, slot, name, source, Math.max(importance, 7), ["user-stated"]);
      }
    }
  }

  // 2. "I use X for Y" / "X is my Y"
  const usePatterns: Array<{ pattern: RegExp; slot: ProfileMemorySlot }> = [
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?video\s*editing\b/i, slot: "video_editor" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?coding\b/i, slot: "code_editor" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?ai\s*coding\b/i, slot: "ai_coding_assistant" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?design\b/i, slot: "design_software" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?(?:chat|communication|video\s*calls?)\b/i, slot: "communication" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?(?:notes|productivity|docs|documents)\b/i, slot: "productivity" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?browser\b/i, slot: "browser" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?terminal\b/i, slot: "terminal" },
    { pattern: /\b(?:i|i typically|i usually|i normally)?\s*use\s+(?:[a-z0-9 .'+-]+?)\s+(?:for|as)\s+(?:my\s+)?(?:music|audio|sound)\b/i, slot: "music_or_audio" },
  ];
  for (const { pattern, slot } of usePatterns) {
    const match = cleaned.match(pattern);
    if (!match) continue;
    const name = collapseWhitespace(match[1] || "").replace(/^(?:i|i typically|i usually|i normally)\s+/i, "");
    if (!name) continue;
    const known = matchKnownSoftware(name);
    if (known) {
      mergeUserValueIntoKnown(acc, known.slot, known.display, Math.max(importance, known.importance));
    } else {
      pushSlotValue(acc, slot, name, source, Math.max(importance, 7), ["user-stated"]);
    }
  }

  // 3. Catch any well-known product mentioned anywhere in the text.
  for (const entry of KNOWN_SOFTWARE) {
    if (entry.pattern.test(cleaned)) {
      pushKnownEntry(acc, entry.slot, entry.display, source, Math.max(importance, entry.importance));
    }
  }
}

/**
 * Extracts structured profile-memory facts (software stack, tooling, business
 * context) from a free-form user message. Each entry can be merged into the
 * existing per-slot snapshot via {@link mergeProfileMemoryEntries}.
 */
export function extractProfileMemoryEntries(
  userText: string,
  options: { source?: ProfileMemoryEntry["source"]; importance?: number } = {}
): ProfileMemoryEntry[] {
  if (isTaskOrLogText(userText)) {
    return [];
  }
  const source = options.source ?? "user_statement";
  const baseImportance = options.importance ?? 7;
  const acc = new Map<ProfileMemorySlot, Map<string, ProfileMemoryEntry>>();

  captureFromFreeText(acc, userText || "", source, baseImportance);

  const flat: ProfileMemoryEntry[] = [];
  for (const bucket of Array.from(acc.values())) {
    for (const entry of Array.from(bucket.values())) {
      flat.push(entry);
    }
  }
  return flat;
}

export type ProfileMemoryMergeResult = {
  snapshot: ProfileMemoryFact[];
  added: ProfileMemoryFact[];
  upgraded: ProfileMemoryFact[];
};

/**
 * Merges new {@link ProfileMemoryEntry} candidates into an existing snapshot
 * and returns the merged list plus the entries that were added or upgraded.
 * The desktop probe and the chat auto-memory flow both call this so the
 * stored facts always reflect the most current information without ever
 * duplicating the same tool across multiple memory documents.
 */
export function mergeProfileMemoryEntries(
  existing: ReadonlyArray<ProfileMemoryFact> | null | undefined,
  incoming: ReadonlyArray<ProfileMemoryEntry>
): ProfileMemoryMergeResult {
  const map = new Map<string, ProfileMemoryFact>();
  for (const fact of existing ?? []) {
    map.set(`${fact.slot}::${normalizeToolKey(fact.value)}`, fact);
  }

  const added: ProfileMemoryFact[] = [];
  const upgraded: ProfileMemoryFact[] = [];

  for (const entry of incoming) {
    const key = `${entry.slot}::${normalizeToolKey(entry.value)}`;
    const previous = map.get(key);
    if (previous) {
      const merged: ProfileMemoryFact = {
        ...previous,
        value: pickLabelFromName(entry.value) || previous.value,
        importance: Math.max(previous.importance, entry.importance),
        tags: Array.from(new Set([...previous.tags, ...entry.tags])),
      };
      if (merged.importance > previous.importance) {
        upgraded.push(merged);
      }
      map.set(key, merged);
    } else {
      const fact: ProfileMemoryFact = {
        slot: entry.slot,
        label: getLabelForSlot(entry.slot),
        value: pickLabelFromName(entry.value) || entry.value,
        importance: entry.importance,
        tags: entry.tags,
      };
      map.set(key, fact);
      added.push(fact);
    }
  }

  const snapshot = Array.from(map.values()).sort((left, right) =>
    left.slot.localeCompare(right.slot) || left.value.localeCompare(right.value)
  );

  return { snapshot, added, upgraded };
}

export { isProfileMemorySlot, isValidSlotName, getLabelForSlot, PROFILE_MEMORY_LABELS, PROFILE_MEMORY_TYPES, getProfileMemoryTagForSlot };
export type { ProfileMemoryEntry, ProfileMemoryFact, ProfileMemorySlot };
