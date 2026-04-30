import { randomUUID } from "crypto";
import { spawn } from "child_process";
import { access, mkdir } from "fs/promises";
import path from "path";

import os from "os";

export type BrowserUseCredentialPayload = {
  label?: string | null;
  login: string;
  password: string;
};

export type BrowserUseRunnerInput = {
  task: string;
  service?: string | null;
  startUrl?: string | null;
  credential?: BrowserUseCredentialPayload | null;
  llmModel?: string | null;
  maxSteps?: number;
  headless?: boolean;
  useCloudBrowser?: boolean;
};

export type BrowserUseRunnerOutput = {
  ok: boolean;
  status: "completed" | "partial" | "needs_input" | "blocked" | "failed";
  summary: string;
  blocker?: string | null;
  followUpQuestions?: string[];
  createdEntities?: string[];
  finalUrl?: string | null;
  screenshotUrl?: string | null;
  notes?: string[];
  errors?: string[];
};



async function runBrowserUseTaskOnce(
  input: BrowserUseRunnerInput
): Promise<BrowserUseRunnerOutput> {
  const runtimeRoot = process.env.VERCEL === "1"
    ? path.join(os.tmpdir(), "browser-use-runtime")
    : path.join(process.cwd(), ".browser-use-runtime");
  const runId = randomUUID();
  const runDir = path.join(runtimeRoot, runId);
  await mkdir(runDir, { recursive: true });

  const runnerPath = path.join(
    process.cwd(),
    "scripts",
    "browser-use",
    "runner.py"
  );
  const browserUseProjectPath = path.join(
    process.cwd(),
    "scripts",
    "browser-use"
  );
  const { command, args } = await resolveBrowserUseRuntime({
    browserUseProjectPath,
    runnerPath,
  });
  const timeoutMs = resolveTimeoutMs();

  return new Promise<BrowserUseRunnerOutput>((resolve) => {
    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      BROWSER_USE_SETUP_LOGGING: "false",
      BROWSER_USE_CONFIG_DIR: path.join(
        runtimeRoot,
        "config"
      ),
      PYTHONIOENCODING: "utf-8",
      PYTHONUTF8: "1",
    };

    const requestedLlmModel = input.llmModel?.trim();
    if (requestedLlmModel) {
      childEnv.BROWSER_USE_LLM_MODEL = requestedLlmModel;
    }

    const child = spawn(
      command,
      args,
      {
        cwd: process.cwd(),
        env: childEnv,
        stdio: ["pipe", "pipe", "pipe"],
        shell: process.platform === "win32",
      }
    );

    let stdout = "";
    let stderr = "";
    let finished = false;

    const finish = (result: BrowserUseRunnerOutput) => {
      if (finished) {
        return;
      }

      finished = true;
      clearTimeout(timeoutHandle);
      resolve(result);
    };

    const timeoutHandle = setTimeout(() => {
      child.kill();
      finish({
        ok: false,
        status: "failed",
        summary: "Browser automation timed out before finishing.",
        errors: [
          `Browser Use exceeded the ${Math.round(timeoutMs / 1000)} second timeout.`,
        ],
      });
    }, timeoutMs);

    child.on("error", (error) => {
      finish({
        ok: false,
        status: "failed",
        summary: "Browser automation could not start.",
        errors: [error.message],
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

      const trimmedStdout = stdout.trim();
      if (code === 0 && trimmedStdout) {
        try {
          const parsed = extractJsonResult(trimmedStdout);
          if (!parsed) {
            throw new Error("No JSON result was found in the Browser Use output.");
          }
          finish(parsed);
          return;
        } catch (error) {
          finish({
            ok: false,
            status: "failed",
            summary: "Browser automation returned an unreadable result.",
            errors: [
              error instanceof Error ? error.message : "Invalid JSON output.",
              stderr.trim(),
            ].filter(Boolean),
          });
          return;
        }
      }

      finish({
        ok: false,
        status: "failed",
        summary: "Browser automation failed before completing the task.",
        errors: [
          `Process exited with code ${String(code)}.`,
          stderr.trim() || trimmedStdout || "No diagnostic output returned.",
        ].filter(Boolean),
      });
    });

    child.stdin.write(
      JSON.stringify({
        ...input,
        runtimeDir: runDir,
      })
    );
    child.stdin.end();
  });
}

async function pathExists(targetPath: string) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBrowserUseRuntime(params: {
  browserUseProjectPath: string;
  runnerPath: string;
}) {
  const localPythonCandidates = [
    path.join(params.browserUseProjectPath, ".venv", "Scripts", "python.exe"),
    path.join(params.browserUseProjectPath, ".venv", "bin", "python"),
  ];

  for (const candidate of localPythonCandidates) {
    if (await pathExists(candidate)) {
      return {
        command: candidate,
        args: [params.runnerPath],
      };
    }
  }

  let uvBin = process.env.BROWSER_USE_UV_BIN?.trim() || "uv";
  if (process.platform === "win32" && uvBin === "uv") {
    const defaultLocalPath = path.join(
      os.homedir(),
      ".local",
      "bin",
      "uv.exe"
    );
    if (await pathExists(defaultLocalPath)) {
      uvBin = defaultLocalPath;
    }
  }

  return {
    command: uvBin,
    args: [
      "--quiet",
      "run",
      "--project",
      params.browserUseProjectPath,
      "python",
      params.runnerPath,
    ],
  };
}

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
      return JSON.parse(line) as BrowserUseRunnerOutput;
    } catch {
      continue;
    }
  }

  return null;
}

function resolveTimeoutMs() {
  const parsed = Number(process.env.BROWSER_USE_TIMEOUT_MS ?? "240000");
  return Number.isFinite(parsed) && parsed > 1000 ? parsed : 240000;
}

function hasAnyValue(values: Array<string | undefined>) {
  return values.some((value) => Boolean(value?.trim()));
}

function getUniqueNonEmptyStrings(values: Array<string | null | undefined>) {
  const uniqueValues = new Set<string>();

  for (const value of values) {
    const normalizedValue = value?.trim();
    if (!normalizedValue) {
      continue;
    }

    uniqueValues.add(normalizedValue);
  }

  return Array.from(uniqueValues);
}

export function isBrowserUseConfigured() {
  const provider = process.env.BROWSER_USE_LLM_PROVIDER?.trim().toLowerCase();
  const hasNvidiaCompatibleKey = hasAnyValue([
    process.env.AI_API_KEY,
    process.env.NVIDIA_API_KEY,
    process.env.Kimi,
    process.env.Gamma,
  ]);

  if (provider === "nvidia") {
    return hasNvidiaCompatibleKey;
  }

  if (provider === "openai") {
    return hasAnyValue([process.env.OPENAI_API_KEY]);
  }

  if (provider === "google") {
    return hasAnyValue([process.env.GOOGLE_API_KEY, process.env.GEMINI_API_KEY]);
  }

  if (provider === "anthropic") {
    return hasAnyValue([process.env.ANTHROPIC_API_KEY]);
  }

  if (provider === "groq") {
    return hasAnyValue([process.env.GROQ_API_KEY]);
  }

  if (provider === "browser-use") {
    return hasAnyValue([process.env.BROWSER_USE_API_KEY]);
  }

  return hasAnyValue([
    process.env.BROWSER_USE_API_KEY,
    process.env.AI_API_KEY,
    process.env.NVIDIA_API_KEY,
    process.env.Gamma,
    process.env.Kimi,
    process.env.OPENAI_API_KEY,
    process.env.GOOGLE_API_KEY,
    process.env.GEMINI_API_KEY,
    process.env.ANTHROPIC_API_KEY,
    process.env.GROQ_API_KEY,
  ]);
}

export async function runBrowserUseTask(
  input: BrowserUseRunnerInput
): Promise<BrowserUseRunnerOutput> {
  if (!isBrowserUseConfigured()) {
    return {
      ok: false,
      status: "failed",
      summary:
        "Browser automation is not configured on this server yet. Add a Browser Use API key or a supported NVIDIA-compatible API key first.",
      errors: [
        "Missing BROWSER_USE_API_KEY or a supported NVIDIA-compatible API key.",
      ],
    };
  }

  const result = await runBrowserUseTaskOnce(input);
  return result;
}
