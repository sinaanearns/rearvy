export type ClickyVoiceScope = "personal" | "team";
export type ClickyVoiceMode = "dictation" | "command";
export type ClickyVoiceRetentionMode = "off" | "metadata" | "transcripts";
export type ClickyVoiceLanguageMode = "auto" | "english" | "multilingual";
export type ClickyVoiceAppCategory =
  | "email"
  | "chat"
  | "docs"
  | "code"
  | "terminal"
  | "browser"
  | "default";

export type ClickyVoiceProfile = {
  userId: string;
  shortcut: string;
  commandShortcut: string;
  commandModeEnabled: boolean;
  contextAwarenessEnabled: boolean;
  pressEnterEnabled: boolean;
  languageMode: ClickyVoiceLanguageMode;
  retentionMode: ClickyVoiceRetentionMode;
  usageAnalyticsVisible: boolean;
  styleDefaults: Partial<Record<ClickyVoiceAppCategory, string>>;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceDictionaryEntry = {
  id: string;
  userId: string;
  teamId?: string | null;
  scope: ClickyVoiceScope;
  spoken: string;
  replacement: string;
  keyterms: string[];
  priority: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceSnippet = {
  id: string;
  userId: string;
  teamId?: string | null;
  scope: ClickyVoiceScope;
  trigger: string;
  expansion: string;
  priority: number;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceStyle = {
  id: string;
  userId: string;
  teamId?: string | null;
  scope: ClickyVoiceScope;
  name: string;
  category: ClickyVoiceAppCategory;
  instructions: string;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceTeam = {
  id: string;
  ownerId: string;
  name: string;
  settings: ClickyVoiceTeamSettings;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceTeamMemberRole = "owner" | "admin" | "member";

export type ClickyVoiceTeamMember = {
  id: string;
  teamId: string;
  userId: string;
  email: string | null;
  role: ClickyVoiceTeamMemberRole;
  createdAt?: string;
  updatedAt?: string;
};

export type ClickyVoiceTeamSettings = {
  contextAwarenessEnabled: boolean;
  retentionMode: ClickyVoiceRetentionMode;
  usageAnalyticsVisible: boolean;
};

export type ClickyVoiceActiveContext = {
  appName?: string | null;
  title?: string | null;
  url?: string | null;
  category?: ClickyVoiceAppCategory | null;
  workspacePath?: string | null;
  workspaceFiles?: string[];
};

export type ClickyVoiceProcessingInput = {
  transcript: string;
  mode?: ClickyVoiceMode;
  command?: string | null;
  selectedText?: string | null;
  profile?: Partial<ClickyVoiceProfile> | null;
  dictionary?: ClickyVoiceDictionaryEntry[];
  snippets?: ClickyVoiceSnippet[];
  styles?: ClickyVoiceStyle[];
  activeContext?: ClickyVoiceActiveContext | null;
};

export type ClickyVoiceProcessingOutput = {
  text: string;
  mode: ClickyVoiceMode;
  pressEnter: boolean;
  replaceSelection: boolean;
  styleId: string | null;
  category: ClickyVoiceAppCategory;
  appliedDictionaryIds: string[];
  appliedSnippetIds: string[];
  appliedFileTags: string[];
  debug: {
    originalTranscript: string;
    normalizedTranscript: string;
    selectedTextUsed: boolean;
  };
};

export const DEFAULT_CLICKY_VOICE_PROFILE: ClickyVoiceProfile = {
  userId: "",
  shortcut: "Ctrl+Alt+Space",
  commandShortcut: "Ctrl+Alt+Shift+Space",
  commandModeEnabled: true,
  contextAwarenessEnabled: true,
  pressEnterEnabled: true,
  languageMode: "auto",
  retentionMode: "off",
  usageAnalyticsVisible: true,
  styleDefaults: {
    email: "formal",
    chat: "casual",
    docs: "clear",
    code: "developer",
    terminal: "terminal",
    browser: "default",
    default: "default",
  },
};

const FILLER_WORDS = [
  "um",
  "uh",
  "erm",
  "hmm",
  "you know",
  "kind of",
  "sort of",
  "basically",
  "actually actually",
];

const ACRONYM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\ba p i\b/gi, "API"],
  [/\bapi\b/gi, "API"],
  [/\bu r l\b/gi, "URL"],
  [/\burl\b/gi, "URL"],
  [/\bh t t p\b/gi, "HTTP"],
  [/\bh t t p s\b/gi, "HTTPS"],
  [/\bjson\b/gi, "JSON"],
  [/\bhtml\b/gi, "HTML"],
  [/\bcss\b/gi, "CSS"],
  [/\bsql\b/gi, "SQL"],
  [/\bcli\b/gi, "CLI"],
  [/\bn p m\b/gi, "npm"],
  [/\bnpm\b/gi, "npm"],
  [/\bgithub\b/gi, "GitHub"],
  [/\bvercel\b/gi, "Vercel"],
  [/\bsupabase\b/gi, "Supabase"],
  [/\bcloudflare\b/gi, "Cloudflare"],
  [/\bfirebase\b/gi, "Firebase"],
  [/\bvs code\b/gi, "VS Code"],
  [/\bvscode\b/gi, "VS Code"],
  [/\bcursor\b/gi, "Cursor"],
  [/\bwindsurf\b/gi, "Windsurf"],
];

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wordBoundaryPattern(value: string) {
  const escaped = escapeRegExp(normalizeWhitespace(value));
  return new RegExp(`(^|[^\\p{L}\\p{N}_])(${escaped})(?=$|[^\\p{L}\\p{N}_])`, "giu");
}

function normalizePhraseKey(value: string) {
  return normalizeWhitespace(value).toLowerCase();
}

function titleCaseSentence(value: string) {
  return value.replace(/(^|[.!?]\s+)([a-z])/g, (_match, prefix: string, char: string) => {
    return `${prefix}${char.toUpperCase()}`;
  });
}

function cleanSpacingAroundPunctuation(value: string) {
  return value
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/([,.;:!?])(?=\S)/g, "$1 ")
    .replace(/\s+\n/g, "\n")
    .replace(/\n\s+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function addTerminalPunctuation(value: string, category: ClickyVoiceAppCategory) {
  const trimmed = value.trim();
  if (!trimmed || category === "code" || category === "terminal") {
    return trimmed;
  }

  if (/[.!?:;)"'\]}]$/.test(trimmed) || trimmed.includes("\n")) {
    return trimmed;
  }

  return `${trimmed}.`;
}

function applySpokenPunctuation(value: string) {
  return value
    .replace(/\bnew paragraph\b/gi, "\n\n")
    .replace(/\bnew line\b/gi, "\n")
    .replace(/\bcomma\b/gi, ",")
    .replace(/\bperiod\b|\bfull stop\b/gi, ".")
    .replace(/\bquestion mark\b/gi, "?")
    .replace(/\bexclamation mark\b/gi, "!")
    .replace(/\bcolon\b/gi, ":")
    .replace(/\bsemicolon\b/gi, ";")
    .replace(/\bopen parenthesis\b|\bopen paren\b/gi, "(")
    .replace(/\bclose parenthesis\b|\bclose paren\b/gi, ")")
    .replace(/\bopen bracket\b/gi, "[")
    .replace(/\bclose bracket\b/gi, "]")
    .replace(/\bopen brace\b/gi, "{")
    .replace(/\bclose brace\b/gi, "}");
}

export function normalizeVoiceProfile(userId: string, value?: Partial<ClickyVoiceProfile> | null): ClickyVoiceProfile {
  const retentionMode =
    value?.retentionMode === "metadata" || value?.retentionMode === "transcripts"
      ? value.retentionMode
      : DEFAULT_CLICKY_VOICE_PROFILE.retentionMode;
  const languageMode =
    value?.languageMode === "english" || value?.languageMode === "multilingual"
      ? value.languageMode
      : DEFAULT_CLICKY_VOICE_PROFILE.languageMode;

  return {
    ...DEFAULT_CLICKY_VOICE_PROFILE,
    ...value,
    userId,
    shortcut: readString(value?.shortcut, DEFAULT_CLICKY_VOICE_PROFILE.shortcut),
    commandShortcut: readString(value?.commandShortcut, DEFAULT_CLICKY_VOICE_PROFILE.commandShortcut),
    commandModeEnabled: value?.commandModeEnabled !== false,
    contextAwarenessEnabled: value?.contextAwarenessEnabled !== false,
    pressEnterEnabled: value?.pressEnterEnabled !== false,
    usageAnalyticsVisible: value?.usageAnalyticsVisible !== false,
    retentionMode,
    languageMode,
    styleDefaults: {
      ...DEFAULT_CLICKY_VOICE_PROFILE.styleDefaults,
      ...(value?.styleDefaults || {}),
    },
  };
}

export function inferVoiceCategory(activeContext?: ClickyVoiceActiveContext | null): ClickyVoiceAppCategory {
  if (activeContext?.category) {
    return activeContext.category;
  }

  const haystack = `${activeContext?.appName || ""} ${activeContext?.title || ""} ${activeContext?.url || ""}`.toLowerCase();
  if (/\b(cursor|windsurf|code|visual studio|vscode|github|gitlab)\b/.test(haystack)) return "code";
  if (/\b(powershell|terminal|cmd|windows terminal|bash|zsh|shell)\b/.test(haystack)) return "terminal";
  if (/\b(gmail|outlook|mail)\b/.test(haystack)) return "email";
  if (/\b(slack|teams|discord|whatsapp|telegram|messages)\b/.test(haystack)) return "chat";
  if (/\b(docs|notion|word|document|confluence)\b/.test(haystack)) return "docs";
  if (/\b(chrome|edge|firefox|browser)\b/.test(haystack)) return "browser";
  return "default";
}

export function extractPressEnter(value: string, enabled = true) {
  if (!enabled) {
    return { text: value.trim(), pressEnter: false };
  }

  const stripped = value
    .trim()
    .replace(/(?:[.?!]\s*)?(?:press|hit|send)\s+enter[.?!\s]*$/i, "")
    .trim();

  return {
    text: stripped,
    pressEnter: stripped !== value.trim(),
  };
}

export function applyBacktracking(value: string) {
  let text = value;
  const scratchMarkers = /\b(?:scratch that|forget that|never mind|nevermind)\b/gi;
  const scratchMatches = Array.from(text.matchAll(scratchMarkers));
  if (scratchMatches.length > 0) {
    const last = scratchMatches[scratchMatches.length - 1];
    text = text.slice((last.index || 0) + last[0].length).trim();
  }

  text = text.replace(
    /\b([A-Za-z0-9:_-]{1,30})\s+(?:actually|i mean)\s+([A-Za-z0-9:_-]{1,30})\b/gi,
    "$2"
  );

  return normalizeWhitespace(text.replace(/\b(?:actually|i mean)\b/gi, ""));
}

export function removeFillers(value: string) {
  let text = value;
  for (const filler of FILLER_WORDS) {
    text = text.replace(wordBoundaryPattern(filler), "$1");
  }

  return normalizeWhitespace(text);
}

function sortByVoicePriority<T extends { scope: ClickyVoiceScope; priority: number; id: string }>(items: T[]) {
  return [...items].sort((left, right) => {
    const scopeScore = (right.scope === "personal" ? 1 : 0) - (left.scope === "personal" ? 1 : 0);
    if (scopeScore !== 0) return scopeScore;
    if (right.priority !== left.priority) return right.priority - left.priority;
    return left.id.localeCompare(right.id);
  });
}

export function applyDictionary(value: string, entries: ClickyVoiceDictionaryEntry[] = []) {
  let text = value;
  const appliedDictionaryIds: string[] = [];
  const seenSpokenForms = new Set<string>();
  const activeEntries = sortByVoicePriority(
    entries.filter((entry) => entry.enabled !== false && entry.spoken.trim() && entry.replacement.trim())
  );

  for (const entry of activeEntries) {
    const spokenKey = normalizePhraseKey(entry.spoken);
    if (seenSpokenForms.has(spokenKey)) {
      continue;
    }
    seenSpokenForms.add(spokenKey);
    const before = text;
    text = text.replace(wordBoundaryPattern(entry.spoken), (_match, prefix: string) => `${prefix}${entry.replacement}`);
    if (text !== before) {
      appliedDictionaryIds.push(entry.id);
    }
  }

  return { text: normalizeWhitespace(text), appliedDictionaryIds };
}

export function applySnippets(value: string, snippets: ClickyVoiceSnippet[] = []) {
  let text = value;
  const appliedSnippetIds: string[] = [];
  const activeSnippets = sortByVoicePriority(
    snippets.filter((snippet) => snippet.enabled !== false && snippet.trigger.trim() && snippet.expansion.trim())
  ).sort((left, right) => {
    const lengthScore = normalizePhraseKey(right.trigger).length - normalizePhraseKey(left.trigger).length;
    return lengthScore !== 0 ? lengthScore : 0;
  });

  for (const snippet of activeSnippets) {
    const before = text;
    text = text.replace(wordBoundaryPattern(snippet.trigger), (_match, prefix: string) => `${prefix}${snippet.expansion}`);
    if (text !== before) {
      appliedSnippetIds.push(snippet.id);
    }
  }

  return { text: text.trim(), appliedSnippetIds };
}

function buildFileSpokenForms(fileName: string) {
  const base = fileName.split(/[\\/]/).pop() || fileName;
  const withoutExtension = base.replace(/\.[^.]+$/, "");
  const extension = base.includes(".") ? base.split(".").pop() || "" : "";
  const spokenBase = withoutExtension
    .replace(/[-_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .toLowerCase();

  const forms = new Set<string>([spokenBase, base.toLowerCase().replace(/\./g, " dot ").replace(/[-_]/g, " ")]);
  if (extension) {
    forms.add(`${spokenBase} dot ${extension.toLowerCase()}`);
    forms.add(`${spokenBase} ${extension.toLowerCase()}`);
  }
  return Array.from(forms).map(normalizePhraseKey).filter(Boolean);
}

export function applyFileTags(value: string, workspaceFiles: string[] = []) {
  let text = value;
  const appliedFileTags: string[] = [];
  const uniqueFiles = Array.from(new Set(workspaceFiles.map((file) => file.trim()).filter(Boolean))).slice(0, 250);
  const filesBySpokenForm = new Map<string, string>();

  for (const file of uniqueFiles) {
    const fileName = file.split(/[\\/]/).pop() || file;
    for (const form of buildFileSpokenForms(fileName)) {
      filesBySpokenForm.set(form, fileName);
    }
  }

  const sortedForms = Array.from(filesBySpokenForm.keys()).sort((left, right) => right.length - left.length);
  for (const form of sortedForms) {
    const fileName = filesBySpokenForm.get(form);
    if (!fileName) continue;
    const before = text;
    text = text.replace(
      new RegExp(`\\b(?:tag|at|@)\\s+${escapeRegExp(form)}\\b`, "gi"),
      `@${fileName}`
    );
    if (text !== before) {
      appliedFileTags.push(fileName);
    }
  }

  text = text.replace(/\b(?:tag|at|@)\s+([a-z0-9_-]+)\s+dot\s+([a-z0-9_-]+)\b/gi, (_match, name: string, ext: string) => {
    const fileName = `${name}.${ext}`;
    appliedFileTags.push(fileName);
    return `@${fileName}`;
  });

  return { text: normalizeWhitespace(text), appliedFileTags: Array.from(new Set(appliedFileTags)) };
}

function toCamelCase(value: string) {
  const words = normalizeWhitespace(value).toLowerCase().split(/\s+/).filter(Boolean);
  return words
    .map((word, index) => (index === 0 ? word : `${word.charAt(0).toUpperCase()}${word.slice(1)}`))
    .join("");
}

function toSnakeCase(value: string) {
  return normalizeWhitespace(value).toLowerCase().replace(/\s+/g, "_");
}

function normalizeDeveloperTerms(value: string) {
  let text = value;
  for (const [pattern, replacement] of ACRONYM_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }
  return text;
}

function applyCodeFormatting(value: string) {
  return normalizeDeveloperTerms(value)
    .replace(/\bcamel case ([a-z][a-z0-9 ]{1,80}?)(?=\s+(?:to|from|equals|comma|period|and|$))/gi, (_match, phrase: string) =>
      toCamelCase(phrase)
    )
    .replace(/\bsnake case ([a-z][a-z0-9 ]{1,80}?)(?=\s+(?:to|from|equals|comma|period|and|$))/gi, (_match, phrase: string) =>
      toSnakeCase(phrase)
    )
    .replace(/\bopen paren close paren\b/gi, "()")
    .replace(/\bopen parenthesis close parenthesis\b/gi, "()")
    .replace(/\bdot\b/gi, ".")
    .replace(/\bslash\b/gi, "/")
    .replace(/\bbackslash\b/gi, "\\")
    .replace(/\bequals\b/gi, "=")
    .replace(/\bdouble quote\b/gi, "\"")
    .replace(/\bsingle quote\b/gi, "'")
    .replace(/@([A-Za-z0-9_-]+)\s*\.\s+([A-Za-z0-9_-]+)/g, "@$1.$2")
    .replace(/(\b[A-Za-z0-9_-]+)\.\s+([A-Za-z0-9_-]+\b)/g, "$1.$2");
}

function applyTerminalFormatting(value: string) {
  return normalizeDeveloperTerms(value)
    .replace(/\bdash dash\b/gi, "--")
    .replace(/\bhyphen hyphen\b/gi, "--")
    .replace(/\bdash\b/gi, "-")
    .replace(/\bhyphen\b/gi, "-")
    .replace(/\bslash\b/gi, "/")
    .replace(/\bbackslash\b/gi, "\\")
    .replace(/\bpipe\b/gi, "|")
    .replace(/\bequals\b/gi, "=")
    .replace(/\bdot\b/gi, ".")
    .replace(/\s+([=/|.])/g, "$1")
    .replace(/([=/|.])\s+/g, "$1")
    .replace(/--\s+/g, "--")
    .replace(/\s+-\s+/g, "-")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function formatNumberedList(value: string) {
  const trimmed = value.trim();
  const matches = Array.from(trimmed.matchAll(/(?:^|\s)(\d{1,2})[\).]?\s+(.+?)(?=(?:\s+\d{1,2}[\).]?\s+)|$)/g));
  if (matches.length < 2 || matches[0]?.[1] !== "1") {
    return value;
  }

  const lines = matches.map((match) => {
    const index = match[1];
    const item = cleanSpacingAroundPunctuation(match[2] || "").replace(/[.;,]$/, "");
    return `${index}. ${titleCaseSentence(item)}`;
  });

  return lines.join("\n");
}

function finalizeWritingText(value: string, category: ClickyVoiceAppCategory) {
  if (category === "code" || category === "terminal") {
    return value.trim();
  }

  let text = cleanSpacingAroundPunctuation(formatNumberedList(value));
  text = titleCaseSentence(text);
  return addTerminalPunctuation(text, category);
}

function commandFallback(command: string, selectedText: string) {
  const normalizedCommand = normalizePhraseKey(command);
  const cleanedSelection = finalizeWritingText(
    removeFillers(applyBacktracking(applySpokenPunctuation(selectedText))),
    "default"
  );

  if (!selectedText.trim()) {
    return finalizeWritingText(removeFillers(applyBacktracking(applySpokenPunctuation(command))), "default");
  }

  if (/\bsummary|summarize|tl;?dr\b/.test(normalizedCommand)) {
    return cleanedSelection.split(/(?<=[.!?])\s+/)[0] || cleanedSelection;
  }

  if (/\bconcise|shorter|tighten\b/.test(normalizedCommand)) {
    return titleCaseSentence(cleanedSelection
      .replace(/\b(in order to)\b/gi, "to")
      .replace(/\b(due to the fact that)\b/gi, "because")
      .replace(/\b(at this point in time)\b/gi, "now"));
  }

  if (/\bexpand|elaborate\b/.test(normalizedCommand)) {
    return `${cleanedSelection}\n\n${finalizeWritingText(command, "default")}`;
  }

  return cleanedSelection;
}

export function getDictionaryKeyterms(entries: ClickyVoiceDictionaryEntry[] = []) {
  const terms = new Set<string>();
  for (const entry of entries) {
    if (entry.enabled === false) continue;
    for (const term of [entry.replacement, ...entry.keyterms]) {
      const cleaned = normalizeWhitespace(term).slice(0, 50);
      if (cleaned && cleaned.split(/\s+/).length <= 6) {
        terms.add(cleaned);
      }
    }
  }
  return Array.from(terms).slice(0, 200);
}

export function resolveStyleId(
  profile: ClickyVoiceProfile,
  styles: ClickyVoiceStyle[] = [],
  category: ClickyVoiceAppCategory
) {
  const configured = profile.styleDefaults[category] || profile.styleDefaults.default || null;
  const enabledStyles = styles.filter((style) => style.enabled !== false);
  const exact = configured
    ? enabledStyles.find((style) => style.id === configured || normalizePhraseKey(style.name) === normalizePhraseKey(configured))
    : null;

  return exact?.id || enabledStyles.find((style) => style.category === category)?.id || null;
}

export function processVoiceTranscript(input: ClickyVoiceProcessingInput): ClickyVoiceProcessingOutput {
  const mode: ClickyVoiceMode = input.mode === "command" ? "command" : "dictation";
  const profile = normalizeVoiceProfile(input.profile?.userId || "", input.profile || null);
  const category = profile.contextAwarenessEnabled ? inferVoiceCategory(input.activeContext) : "default";
  const originalTranscript = readString(input.transcript);
  const commandText = readString(input.command, originalTranscript);
  const selectedText = readString(input.selectedText);

  const pressEnterResult = extractPressEnter(originalTranscript, profile.pressEnterEnabled);
  let text = pressEnterResult.text;

  text = applySpokenPunctuation(text);
  text = applyBacktracking(text);
  text = removeFillers(text);

  const dictionaryResult = applyDictionary(text, input.dictionary || []);
  text = dictionaryResult.text;

  const snippetResult = applySnippets(text, input.snippets || []);
  text = snippetResult.text;

  const fileTagResult =
    category === "code" || category === "terminal"
      ? applyFileTags(text, input.activeContext?.workspaceFiles || [])
      : { text, appliedFileTags: [] };
  text = fileTagResult.text;

  if (category === "terminal") {
    text = applyTerminalFormatting(text);
  } else if (category === "code") {
    text = applyCodeFormatting(text);
  }

  if (mode === "command") {
    text = commandFallback(commandText || text, selectedText);
  } else {
    text = finalizeWritingText(text, category);
  }

  return {
    text,
    mode,
    pressEnter: pressEnterResult.pressEnter,
    replaceSelection: mode === "command" && Boolean(selectedText),
    styleId: resolveStyleId(profile, input.styles || [], category),
    category,
    appliedDictionaryIds: dictionaryResult.appliedDictionaryIds,
    appliedSnippetIds: snippetResult.appliedSnippetIds,
    appliedFileTags: fileTagResult.appliedFileTags,
    debug: {
      originalTranscript,
      normalizedTranscript: text,
      selectedTextUsed: Boolean(selectedText),
    },
  };
}
