import { normalizeGeneratedMediaUrls } from "./generated-media-url";

export type AssistantTimelineStatus = "pending" | "running" | "completed" | "failed";

export type AssistantTimelinePreview =
  | {
      kind: "table";
      columns: string[];
      rows: string[][];
      totalRows: number;
    }
  | {
      kind: "links";
      links: Array<{ label: string; url: string }>;
    }
  | {
      kind: "media";
      mediaType: "image" | "video";
      urls: string[];
    }
  | {
      kind: "map";
      title: string;
      focus?: string;
      viewport: {
        center: [number, number];
        zoom: number;
      };
    };

export type AssistantTimelineEntry = {
  key: string;
  toolName: string;
  label: string;
  status: AssistantTimelineStatus;
  summary: string | null;
  input: unknown;
  output: unknown;
  inputDetail: string | null;
  outputDetail: string | null;
  preview: AssistantTimelinePreview | null;
};

export type AssistantTimelineError = {
  toolName: string;
  errorCode: string;
  message: string;
};

/**
 * The compact state used by the live task panel. Tool entries remain the
 * source of truth; this merely partitions them for presentation so a task can
 * never appear in more than one live section.
 */
export type AssistantTaskPanelState = {
  completed: AssistantTimelineEntry[];
  current: AssistantTimelineEntry | null;
  upcoming: AssistantTimelineEntry[];
  completedCount: number;
  runningCount: number;
  remainingCount: number;
  failedCount: number;
};

export type AssistantTimelineMetadata = {
  assistantName: string;
  traceStartedAt: string | null;
  traceFinishedAt: string | null;
  traceDurationMs: number | null;
};

type TimelinePart = {
  type?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
  state?: unknown;
  input?: unknown;
  output?: unknown;
  args?: unknown;
  result?: unknown;
  errorText?: unknown;
};

const SENSITIVE_KEY_PATTERN =
  /token|secret|password|api[-_]?key|authorization|cookie/i;

const TOOL_LABELS: Record<string, string> = {
  searchMemories: "MemorySearch",
  saveMemory: "MemorySave",
  askUser: "AskUser",
  searchWeb: "WebSearch",
  fetchWebPage: "WebFetch",
  getCurrentDate: "DateCheck",
  getIntegrationStatus: "IntegrationCheck",
  getRecentInsights: "InsightSearch",
  runBrowserTask: "SessionsSpawn",
  controlBrowserSession: "SessionsCommand",
  stopBrowserSession: "SessionsStop",
  planWorkflow: "TaskCreate",
  executeWorkflow: "TaskUpdate",
  listWorkflowTemplates: "TaskTemplates",
  getWorkflowStatus: "TaskStatus",
  prepareGmailMessage: "GmailDraft",
  generateMap: "MapGenerate",
  generateDocument: "DocumentCreate",
  getTradingOpinion: "TradingOpinion",
  getBestTradeOpportunity: "TradeSearch",
  getVerifiedTraderSignals: "TraderSignals",
  getYouTubeChannelStats: "YouTubeStats",
  getYouTubeComments: "YouTubeComments",
  getYouTubeVideoPerformance: "YouTubeVideo",
  runWhispernetAnalysis: "Whispernet",
};

const DIRECT_SUMMARY_KEYS = [
  "query",
  "prompt",
  "task",
  "description",
  "message",
  "summary",
  "title",
  "name",
  "url",
  "reason",
  "errorDetails",
  "error",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const trimmed = value.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
}

function truncateText(text: string, limit = 120) {
  const normalized = text.trim().replace(/\s+/g, " ");
  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit - 3)}...`;
}

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function redactUrl(value: string) {
  try {
    const url = new URL(value);
    for (const key of Array.from(url.searchParams.keys())) {
      if (SENSITIVE_KEY_PATTERN.test(key)) {
        url.searchParams.set(key, "[REDACTED]");
      }
    }
    return url.toString();
  } catch {
    return value;
  }
}

export function redactSensitiveValue(
  value: unknown,
  depth = 0,
  seen = new WeakSet<object>()
): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === "string") {
    return redactUrl(value);
  }

  if (typeof value !== "object") {
    return value;
  }

  if (seen.has(value)) {
    return "[Circular]";
  }

  if (depth >= 6) {
    return "[Truncated]";
  }

  seen.add(value);

  if (Array.isArray(value)) {
    return value
      .slice(0, 25)
      .map((item) => redactSensitiveValue(item, depth + 1, seen));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    redacted[key] = SENSITIVE_KEY_PATTERN.test(key)
      ? "[REDACTED]"
      : redactSensitiveValue(item, depth + 1, seen);
  }

  return redacted;
}

export function formatExpandedValue(value: unknown, limit = 4000) {
  if (value == null) {
    return null;
  }

  const redacted = redactSensitiveValue(value);
  const text =
    typeof redacted === "string"
      ? redacted
      : typeof redacted === "number" || typeof redacted === "boolean"
        ? String(redacted)
        : JSON.stringify(redacted, null, 2);

  const normalized = text?.trim();
  if (!normalized) {
    return null;
  }

  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit - 3)}...`;
}

function resolveToolName(part: TimelinePart) {
  if (typeof part.toolName === "string" && part.toolName.trim()) {
    return part.toolName.trim();
  }

  if (typeof part.type !== "string") {
    return "tool";
  }

  if (part.type === "dynamic-tool") {
    return "dynamicTool";
  }

  return part.type
    .replace(/^tool-/, "")
    .replace(/-available$/, "")
    .replace(/-error$/, "");
}

function getPayload(part: TimelinePart) {
  if (part.output !== undefined && part.output !== null) {
    return part.output;
  }

  if (part.result !== undefined && part.result !== null) {
    return part.result;
  }

  return null;
}

function getToolMode(input: unknown, output: unknown) {
  const inputMode = isRecord(input) && typeof input.mode === "string" ? input.mode : null;
  const outputMode = isRecord(output) && typeof output.mode === "string" ? output.mode : null;
  return outputMode || inputMode;
}

export function formatTimelineToolLabel(
  toolName: string,
  input?: unknown,
  output?: unknown
) {
  if (TOOL_LABELS[toolName]) {
    return TOOL_LABELS[toolName];
  }

  const formatted = toolName
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return formatted
    ? formatted.replace(/\b\w/g, (character) => character.toUpperCase())
    : "Tool";
}

function summarizeArray(value: unknown[]) {
  if (value.length === 0) {
    return "0 items";
  }

  if (value.every((item) => isRecord(item))) {
    return pluralize(value.length, "row");
  }

  return pluralize(value.length, "item");
}

function summarizeRecord(record: Record<string, unknown>) {
  if (Array.isArray(record.images)) {
    return `Generated ${pluralize(record.images.length, "image")}`;
  }

  if (Array.isArray(record.videos)) {
    return `Generated ${pluralize(record.videos.length, "video")}`;
  }

  if (Array.isArray(record.files)) {
    return `Created ${pluralize(record.files.length, "file")}`;
  }

  if (Array.isArray(record.results)) {
    return `Found ${pluralize(record.results.length, "result")}`;
  }

  if (Array.isArray(record.products)) {
    return `Found ${pluralize(record.products.length, "product")}`;
  }

  if (Array.isArray(record.items)) {
    return pluralize(record.items.length, "item");
  }

  for (const key of DIRECT_SUMMARY_KEYS) {
    const direct = firstNonEmptyString(record[key]);
    if (direct) {
      return truncateText(direct);
    }
  }

  if (typeof record.count === "number") {
    return pluralize(record.count, "item");
  }

  if (typeof record.saved === "boolean") {
    return record.saved ? "Saved successfully" : "Not saved";
  }

  const compactEntries = Object.entries(record)
    .filter(([, value]) => {
      return (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
      );
    })
    .slice(0, 3)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return compactEntries.length > 0
    ? truncateText(compactEntries.join(" | "))
    : null;
}

export function summarizeTimelineValue(value: unknown) {
  if (value == null) {
    return null;
  }

  const redacted = redactSensitiveValue(value);

  if (typeof redacted === "string") {
    return truncateText(redacted);
  }

  if (typeof redacted === "number" || typeof redacted === "boolean") {
    return String(redacted);
  }

  if (Array.isArray(redacted)) {
    return summarizeArray(redacted);
  }

  if (isRecord(redacted)) {
    return summarizeRecord(redacted);
  }

  return null;
}

function stringFromCell(value: unknown) {
  if (value == null) {
    return "";
  }

  if (typeof value === "string") {
    return truncateText(value, 80);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return truncateText(JSON.stringify(value), 80);
}

function buildTablePreview(rows: unknown[]): AssistantTimelinePreview | null {
  const objectRows = rows.filter(isRecord);
  if (objectRows.length === 0) {
    return null;
  }

  const columns = Array.from(
    new Set(
      objectRows
        .flatMap((row) => Object.keys(row))
        .filter((key) => !SENSITIVE_KEY_PATTERN.test(key))
    )
  ).slice(0, 4);

  if (columns.length === 0) {
    return null;
  }

  return {
    kind: "table",
    columns,
    rows: objectRows
      .slice(0, 4)
      .map((row) => columns.map((column) => stringFromCell(row[column]))),
    totalRows: objectRows.length,
  };
}

function buildLinksPreview(value: unknown): AssistantTimelinePreview | null {
  const urls: Array<{ label: string; url: string }> = [];

  function readHttpUrl(value: string) {
    try {
      const url = new URL(value);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        return null;
      }

      const redacted = redactUrl(value);
      return {
        hostname: url.hostname,
        url: redacted,
      };
    } catch {
      return null;
    }
  }

  function collect(candidate: unknown) {
    if (typeof candidate === "string") {
      const parsed = readHttpUrl(candidate);
      if (parsed) {
        urls.push({ label: parsed.hostname, url: parsed.url });
      }
      return;
    }

    if (Array.isArray(candidate)) {
      for (const item of candidate.slice(0, 8)) {
        collect(item);
      }
      return;
    }

    if (!isRecord(candidate)) {
      return;
    }

    const url = firstNonEmptyString(candidate.url, candidate.href, candidate.link);
    const parsed = url ? readHttpUrl(url) : null;
    if (parsed) {
      urls.push({
        label: firstNonEmptyString(candidate.title, candidate.source) ?? parsed.hostname,
        url: parsed.url,
      });
    }

    for (const key of ["results", "sources", "items"]) {
      if (Array.isArray(candidate[key])) {
        collect(candidate[key]);
      }
    }
  }

  collect(value);

  if (urls.length === 0) {
    return null;
  }

  return {
    kind: "links",
    links: urls.slice(0, 4),
  };
}

function buildMediaPreview(value: unknown): AssistantTimelinePreview | null {
  if (!isRecord(value)) {
    return null;
  }

  if (Array.isArray(value.images) && value.images.length > 0) {
    const urls = normalizeGeneratedMediaUrls(value.images, "image").slice(0, 3);
    if (urls.length === 0) {
      return null;
    }

    return {
      kind: "media",
      mediaType: "image",
      urls,
    };
  }

  if (Array.isArray(value.videos) && value.videos.length > 0) {
    const urls = normalizeGeneratedMediaUrls(value.videos, "video").slice(0, 3);
    if (urls.length === 0) {
      return null;
    }

    return {
      kind: "media",
      mediaType: "video",
      urls,
    };
  }

  return null;
}

function buildMapPreview(value: unknown): AssistantTimelinePreview | null {
  if (!isRecord(value) || value.kind !== "map") {
    return null;
  }
  const title = typeof value.title === "string" ? value.title : "Map";
  const focus = typeof value.focus === "string" ? value.focus : undefined;
  const viewport = isRecord(value.viewport) ? value.viewport : null;
  const center = Array.isArray(viewport?.center) && viewport.center.length >= 2
    ? [Number(viewport.center[0]), Number(viewport.center[1])] as [number, number]
    : [0, 0] as [number, number];
  const zoom = typeof viewport?.zoom === "number" ? viewport.zoom : 10;

  return {
    kind: "map",
    title,
    focus,
    viewport: {
      center,
      zoom,
    },
  };
}

export function buildTimelinePreview(value: unknown): AssistantTimelinePreview | null {
  if (Array.isArray(value)) {
    return buildTablePreview(value);
  }

  if (isRecord(value)) {
    const mapPreview = buildMapPreview(value);
    if (mapPreview) {
      return mapPreview;
    }

    const mediaPreview = buildMediaPreview(value);
    if (mediaPreview) {
      return mediaPreview;
    }

    for (const key of ["results", "products", "items", "rows"]) {
      if (Array.isArray(value[key])) {
        const tablePreview = buildTablePreview(value[key]);
        if (tablePreview) {
          return tablePreview;
        }
      }
    }
  }

  return buildLinksPreview(value);
}

function inferStatus(part: TimelinePart): AssistantTimelineStatus {
  const state = typeof part.state === "string" ? part.state : "";

  if (
    state.includes("error") ||
    state.includes("denied") ||
    typeof part.errorText === "string"
  ) {
    return "failed";
  }

  if (
    state.includes("output-available") ||
    state.includes("result") ||
    getPayload(part) !== null
  ) {
    return "completed";
  }

  if (
    state.includes("pending") ||
    state.includes("queued") ||
    state.includes("approval")
  ) {
    return "pending";
  }

  return "running";
}

function mergeStatus(
  current: AssistantTimelineStatus,
  next: AssistantTimelineStatus
): AssistantTimelineStatus {
  if (current === "failed" || next === "failed") {
    return "failed";
  }

  if (current === "completed" || next === "completed") {
    return "completed";
  }

  if (current === "running" || next === "running") {
    return "running";
  }

  return "pending";
}

export function buildAssistantTimelineEntries(parts: unknown[] = []) {
  const entries = new Map<string, AssistantTimelineEntry>();

  for (const [index, part] of parts.entries()) {
    if (!isRecord(part)) {
      continue;
    }

    const tracePart = part as TimelinePart;
    const type = typeof tracePart.type === "string" ? tracePart.type : "";
    if (!type.startsWith("tool-") && type !== "dynamic-tool") {
      continue;
    }

    const key =
      typeof tracePart.toolCallId === "string" && tracePart.toolCallId.trim()
        ? tracePart.toolCallId
        : `${type}-${index}`;
    const input = tracePart.input ?? tracePart.args ?? null;
    const output = getPayload(tracePart);
    const toolName = resolveToolName(tracePart);
    const status = inferStatus(tracePart);
    const summary =
      status === "running"
        ? summarizeTimelineValue(input) ?? summarizeTimelineValue(output)
        : summarizeTimelineValue(output) ?? summarizeTimelineValue(input);
    const preview = buildTimelinePreview(output) ?? buildTimelinePreview(input);
    const nextEntry: AssistantTimelineEntry = {
      key,
      toolName,
      label: formatTimelineToolLabel(toolName, input, output),
      status,
      summary,
      input,
      output,
      inputDetail: formatExpandedValue(input),
      outputDetail: formatExpandedValue(output),
      preview,
    };

    const existing = entries.get(key);
    if (!existing) {
      entries.set(key, nextEntry);
      continue;
    }

    entries.set(key, {
      ...existing,
      toolName: nextEntry.toolName || existing.toolName,
      label: nextEntry.label || existing.label,
      status: mergeStatus(existing.status, nextEntry.status),
      summary: nextEntry.summary ?? existing.summary,
      input: nextEntry.input ?? existing.input,
      output: nextEntry.output ?? existing.output,
      inputDetail: nextEntry.inputDetail ?? existing.inputDetail,
      outputDetail: nextEntry.outputDetail ?? existing.outputDetail,
      preview: nextEntry.preview ?? existing.preview,
    });
  }

  return [...entries.values()];
}

export function buildAssistantTaskPanelState(
  entries: AssistantTimelineEntry[]
): AssistantTaskPanelState {
  const completed = entries.filter((entry) => entry.status === "completed");
  const running = entries.filter((entry) => entry.status === "running");
  const upcoming = entries.filter((entry) => entry.status === "pending");
  const failedCount = entries.filter((entry) => entry.status === "failed").length;

  return {
    completed,
    // The latest running entry is the one currently receiving streamed state.
    // Keeping other concurrent entries out of this section prevents duplicate
    // task rows while the count still accurately reports their presence.
    current: running.at(-1) ?? null,
    upcoming,
    completedCount: completed.length,
    runningCount: running.length,
    remainingCount: upcoming.length,
    failedCount,
  };
}

export function getAssistantTimelineErrors(metadata: unknown): AssistantTimelineError[] {
  const record = isRecord(metadata) ? metadata : null;
  const errors = record?.toolErrors;
  if (!Array.isArray(errors)) {
    return [];
  }

  return errors
    .map((error) => {
      if (!isRecord(error)) {
        return null;
      }

      return {
        toolName: firstNonEmptyString(error.toolName) ?? "Unknown tool",
        errorCode: firstNonEmptyString(error.errorCode) ?? "TOOL_ERROR",
        message: firstNonEmptyString(error.message) ?? "Tool execution failed.",
      };
    })
    .filter((error): error is AssistantTimelineError => error !== null);
}

function parseIso(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getAssistantTimelineMetadata(metadata: unknown): AssistantTimelineMetadata {
  const record = isRecord(metadata) ? metadata : {};
  return {
    assistantName: firstNonEmptyString(record.assistantName) ?? "Rearvy",
    traceStartedAt: firstNonEmptyString(record.traceStartedAt),
    traceFinishedAt: firstNonEmptyString(record.traceFinishedAt),
    traceDurationMs: readNumber(record.traceDurationMs),
  };
}

export function formatDurationMs(durationMs: number) {
  if (durationMs < 1000) {
    return `${Math.max(1, Math.round(durationMs))}ms`;
  }

  const totalSeconds = Math.round(durationMs / 100) / 10;
  if (totalSeconds < 60) {
    return `${totalSeconds % 1 === 0 ? totalSeconds.toFixed(0) : totalSeconds.toFixed(1)}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  return `${minutes}m ${seconds}s`;
}

export function getAssistantTimelineDurationLabel(
  metadata: unknown,
  isLoading: boolean,
  now = Date.now()
) {
  if (isLoading) {
    return "Working...";
  }

  const timelineMetadata = getAssistantTimelineMetadata(metadata);
  const durationFromMetadata = timelineMetadata.traceDurationMs;
  if (durationFromMetadata !== null) {
    return `Worked for ${formatDurationMs(durationFromMetadata)}`;
  }

  const startedAt = parseIso(timelineMetadata.traceStartedAt);
  const finishedAt = parseIso(timelineMetadata.traceFinishedAt);
  if (startedAt !== null && finishedAt !== null && finishedAt >= startedAt) {
    return `Worked for ${formatDurationMs(finishedAt - startedAt)}`;
  }

  if (startedAt !== null && now >= startedAt) {
    return `Worked for ${formatDurationMs(now - startedAt)}`;
  }

  return "Worked";
}
