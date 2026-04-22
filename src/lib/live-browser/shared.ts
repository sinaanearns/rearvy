import { z } from "zod";

export const BROWSER_WS_STREAM_PATH = "/browser-stream";
export const DEFAULT_BROWSER_WS_PORT = 3201;
export const DEFAULT_BROWSER_VIEWPORT = {
  width: 1440,
  height: 960,
} as const;
export const DEFAULT_BROWSER_CAPTURE_INTERVAL_MS = 500;
export const DEFAULT_BROWSER_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

export const browserCommandSchema = z.object({
  action: z.enum(["goto", "click", "type", "scroll"]),
  target: z.string().trim().min(1).optional(),
  value: z.union([z.string(), z.number()]).optional(),
});

export const browserCommandBatchSchema = z.object({
  commands: z.array(browserCommandSchema).min(1).max(20),
});

export const browserSessionCommandRequestSchema = z
  .object({
    command: browserCommandSchema.optional(),
    commands: z.array(browserCommandSchema).min(1).max(20).optional(),
  })
  .refine((value) => Boolean(value.command || value.commands?.length), {
    message: "Provide at least one browser command.",
    path: ["command"],
  });

export const browserSessionCreateSchema = z.object({
  url: z.string().trim().url().optional(),
  headless: z.boolean().optional().default(true),
  commands: z.array(browserCommandSchema).min(1).max(20).optional(),
});

export type BrowserCommandInput = z.infer<typeof browserCommandSchema>;
export type BrowserCommandAction = BrowserCommandInput["action"];
export type BrowserSessionCreateInput = z.infer<
  typeof browserSessionCreateSchema
>;

export type BrowserActionLogEntry = {
  id: string;
  action: BrowserCommandAction;
  target: string | null;
  value: string | number | null;
  status: "running" | "completed" | "failed";
  message: string;
  timestamp: string;
};

export type BrowserSessionStatus =
  | "launching"
  | "ready"
  | "running"
  | "failed"
  | "closed";

export type BrowserSessionSnapshot = {
  sessionId: string;
  status: BrowserSessionStatus;
  currentUrl: string | null;
  title: string | null;
  frameDataUrl: string | null;
  lastAction: BrowserActionLogEntry | null;
  actionLog: BrowserActionLogEntry[];
  createdAt: string;
  updatedAt: string;
  headless: boolean;
  streamPort: number;
  streamPath: string;
  streamToken: string;
};

export type BrowserCommandExecutionResult = {
  ok: boolean;
  session: BrowserSessionSnapshot;
  summary: string;
  error?: string | null;
};

export function getConfiguredBrowserWsPort() {
  const rawValue =
    process.env.NEXT_PUBLIC_BROWSER_WS_PORT ??
    process.env.REARVY_BROWSER_WS_PORT ??
    String(DEFAULT_BROWSER_WS_PORT);
  const port = Number(rawValue);
  return Number.isFinite(port) && port > 0 ? port : DEFAULT_BROWSER_WS_PORT;
}

export function buildBrowserWebSocketUrl(params: {
  port: number;
  sessionId: string;
  streamToken: string;
  protocol?: string | null;
  hostname?: string | null;
  path?: string | null;
}) {
  const protocol =
    params.protocol === "https:" || params.protocol === "wss:" ? "wss" : "ws";
  const hostname = params.hostname?.trim() || "localhost";
  const path =
    params.path && params.path.trim()
      ? params.path.startsWith("/")
        ? params.path
        : `/${params.path}`
      : BROWSER_WS_STREAM_PATH;
  const searchParams = new URLSearchParams({
    sessionId: params.sessionId,
    token: params.streamToken,
  });

  return `${protocol}://${hostname}:${params.port}${path}?${searchParams.toString()}`;
}
