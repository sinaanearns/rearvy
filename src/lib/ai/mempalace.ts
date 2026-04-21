import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

type MemoryToolTrace = {
  tools: Array<{
    name: string;
    args: Record<string, unknown>;
    result: unknown;
  }>;
};

type MempalaceScope = {
  userId: string;
  chatId: string;
  projectId?: string | null;
  agentId?: string | null;
};

type MempalaceRecallInput = MempalaceScope & {
  userText: string;
};

type MempalaceCaptureInput = MempalaceScope & {
  userMessage: string;
  assistantMessage: string;
  model: string;
  provider: string;
  trace?: MemoryToolTrace;
};

type MempalaceSearchResult = {
  text?: string;
  wing?: string;
  room?: string;
  source_file?: string;
  similarity?: number;
};

type MempalaceSearchPayload = {
  results?: MempalaceSearchResult[];
  error?: string;
  hint?: string;
};

type BridgeResponse = {
  ok?: boolean;
  error?: string;
  details?: string;
  version?: string;
  wakeUp?: string;
  search?: MempalaceSearchPayload;
  output?: string;
};

const PROBE_TTL_MS = 60_000;
const MEMPALACE_AGENT = "rearvy";

let availabilityCache:
  | {
      checkedAt: number;
      available: boolean;
    }
  | null = null;

function extractJsonResult(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (!line.startsWith("{") || !line.endsWith("}")) {
      continue;
    }

    try {
      return JSON.parse(line) as BridgeResponse;
    } catch {
      continue;
    }
  }

  return null;
}

function parseEnvNumber(
  value: string | undefined,
  predicate: (num: number) => boolean
) {
  if (!value) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && predicate(parsed) ? parsed : null;
}

function resolvePythonBin() {
  return process.env.MEMPALACE_PYTHON_BIN?.trim() || "python";
}

function resolveTimeoutMs() {
  const parsed = parseEnvNumber(
    process.env.MEMPALACE_TIMEOUT_MS,
    (num) => num >= 5_000
  );
  return parsed ?? 120_000;
}

function resolveSearchResults() {
  const parsed = parseEnvNumber(
    process.env.MEMPALACE_SEARCH_RESULTS,
    (num) => num >= 1 && num <= 10
  );
  return parsed ?? 5;
}

function resolveOptionalPath(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return path.isAbsolute(trimmed)
    ? trimmed
    : path.join(process.cwd(), trimmed);
}

function resolvePalacePath() {
  return resolveOptionalPath(process.env.MEMPALACE_PALACE_PATH);
}

function resolveTranscriptRoot() {
  return (
    resolveOptionalPath(process.env.MEMPALACE_TRANSCRIPTS_DIR) ??
    path.join(process.cwd(), ".mempalace-runtime", "transcripts")
  );
}

function sanitizeSegment(value: string) {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "default";
}

function buildWing(scope: Pick<MempalaceScope, "userId" | "projectId">) {
  if (scope.projectId?.trim()) {
    return `rearvy-project-${sanitizeSegment(scope.projectId)}`;
  }

  return `rearvy-user-${sanitizeSegment(scope.userId)}`;
}

function buildAgentTag(agentId?: string | null) {
  if (!agentId?.trim()) {
    return MEMPALACE_AGENT;
  }

  return `${MEMPALACE_AGENT}-${sanitizeSegment(agentId)}`;
}

function truncateText(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 3)}...` : value;
}

function shouldDisableMempalace() {
  return process.env.MEMPALACE_ENABLED?.trim().toLowerCase() === "false";
}

async function runBridge(
  command: "probe" | "recall" | "capture",
  payload: Record<string, unknown>
): Promise<BridgeResponse> {
  const bridgePath = path.join(process.cwd(), "scripts", "mempalace_bridge.py");
  const pythonBin = resolvePythonBin();
  const timeoutMs = resolveTimeoutMs();

  return new Promise<BridgeResponse>((resolve) => {
    const child = spawn(pythonBin, [bridgePath, command], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        PYTHONIOENCODING: "utf-8",
      },
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let finished = false;

    const finish = (response: BridgeResponse) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutHandle);
      resolve(response);
    };

    const timeoutHandle = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        error: "MemPalace bridge timed out.",
        details: `The bridge exceeded the ${Math.round(timeoutMs / 1000)} second timeout.`,
      });
    }, timeoutMs);

    child.on("error", (error) => {
      finish({
        ok: false,
        error: "MemPalace bridge could not start.",
        details: error.message,
      });
    });

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (finished) {
        return;
      }

      const parsed = extractJsonResult(stdout.trim());
      if (parsed) {
        finish(parsed);
        return;
      }

      finish({
        ok: false,
        error: "MemPalace bridge returned unreadable output.",
        details:
          stderr.trim() || stdout.trim() || `Process exited with code ${String(code)}.`,
      });
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

async function isMempalaceAvailable() {
  if (shouldDisableMempalace()) {
    return false;
  }

  if (
    availabilityCache &&
    Date.now() - availabilityCache.checkedAt < PROBE_TTL_MS
  ) {
    return availabilityCache.available;
  }

  const response = await runBridge("probe", {});
  const available = response.ok === true;
  availabilityCache = {
    checkedAt: Date.now(),
    available,
  };

  if (!available) {
    console.warn("MemPalace disabled:", response.error, response.details ?? "");
  }

  return available;
}

function buildRecallContext(params: {
  wakeUp: string;
  hits: MempalaceSearchResult[];
}) {
  const sections: string[] = [];
  const wakeUp = params.wakeUp.trim();
  const hasUsefulWakeUp =
    wakeUp.length > 0 &&
    !/No identity configured|No palace found|No memories yet/i.test(wakeUp);

  if (hasUsefulWakeUp) {
    sections.push(`MEMPALACE WAKE-UP\n${wakeUp}`);
  }

  if (params.hits.length > 0) {
    const results = params.hits
      .map((hit, index) => {
        const room = hit.room?.trim() || "unknown-room";
        const source = hit.source_file?.trim() || "unknown-source";
        const similarity =
          typeof hit.similarity === "number"
            ? `similarity ${hit.similarity.toFixed(3)}`
            : "similarity n/a";
        const text = truncateText((hit.text ?? "").trim(), 1_000);

        return `[${index + 1}] ${room} | ${source} | ${similarity}\n${text}`;
      })
      .join("\n\n");

    sections.push(`MEMPALACE SEARCH HITS\n${results}`);
  }

  return sections.length > 0 ? sections.join("\n\n") : null;
}

function renderTraceBlock(trace?: MemoryToolTrace) {
  if (!trace || trace.tools.length === 0) {
    return "";
  }

  return trace.tools
    .map((tool, index) => {
      return [
        `Tool ${index + 1}: ${tool.name}`,
        `Args: ${JSON.stringify(tool.args)}`,
        `Result: ${JSON.stringify(tool.result)}`,
      ].join("\n");
    })
    .join("\n\n");
}

function renderTranscript(input: MempalaceCaptureInput) {
  const traceBlock = renderTraceBlock(input.trace);
  const lines = [
    `Timestamp: ${new Date().toISOString()}`,
    `Chat ID: ${input.chatId}`,
    `User ID: ${input.userId}`,
    ...(input.projectId ? [`Project ID: ${input.projectId}`] : []),
    ...(input.agentId ? [`Agent ID: ${input.agentId}`] : []),
    `Provider: ${input.provider}`,
    `Model: ${input.model}`,
    "",
    "User:",
    input.userMessage.trim(),
    "",
    "Assistant:",
    input.assistantMessage.trim(),
  ];

  if (traceBlock) {
    lines.push("", "Tool Trace:", traceBlock);
  }

  return `${lines.join("\n")}\n`;
}

export async function buildMempalaceRecallContext({
  userText,
  ...scope
}: MempalaceRecallInput) {
  try {
    const trimmedUserText = userText.trim();
    if (!trimmedUserText) {
      return null;
    }

    if (!(await isMempalaceAvailable())) {
      return null;
    }

    const response = await runBridge("recall", {
      palacePath: resolvePalacePath(),
      query: trimmedUserText,
      results: resolveSearchResults(),
      wing: buildWing(scope),
    });

    if (!response.ok) {
      console.warn(
        "MemPalace recall skipped:",
        response.error,
        response.details ?? ""
      );
      return null;
    }

    const hits = Array.isArray(response.search?.results)
      ? response.search.results.filter(
          (hit): hit is MempalaceSearchResult =>
            Boolean(hit) &&
            typeof hit === "object" &&
            typeof hit.text === "string" &&
            hit.text.trim().length > 0
        )
      : [];

    return buildRecallContext({
      wakeUp: typeof response.wakeUp === "string" ? response.wakeUp : "",
      hits,
    });
  } catch (error) {
    console.warn("MemPalace recall skipped:", error);
    return null;
  }
}

export async function captureMempalaceConversation(
  input: MempalaceCaptureInput
) {
  try {
    const trimmedUserMessage = input.userMessage.trim();
    const trimmedAssistantMessage = input.assistantMessage.trim();

    if (!trimmedUserMessage || !trimmedAssistantMessage) {
      return;
    }

    if (!(await isMempalaceAvailable())) {
      return;
    }

    const wing = buildWing(input);
    const transcriptRoot = resolveTranscriptRoot();
    const transcriptDir = path.join(
      transcriptRoot,
      wing,
      sanitizeSegment(input.chatId),
      randomUUID()
    );
    const transcriptPath = path.join(transcriptDir, "turn.md");

    await mkdir(transcriptDir, { recursive: true });
    await writeFile(transcriptPath, renderTranscript(input), "utf8");

    const response = await runBridge("capture", {
      agent: buildAgentTag(input.agentId),
      palacePath: resolvePalacePath(),
      transcriptPath,
      wing,
    });

    if (!response.ok) {
      console.warn(
        "MemPalace capture skipped:",
        response.error,
        response.details ?? ""
      );
    }
  } catch (error) {
    console.warn("MemPalace capture skipped:", error);
  }
}
