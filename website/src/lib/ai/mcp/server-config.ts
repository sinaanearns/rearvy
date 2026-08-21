import type { McpServerConfig, McpToolCatalogEntry } from "@/lib/firebase/schema";

export const MCP_SERVER_TRANSPORTS = ["stdio", "sse", "streamable_http"] as const;
export type McpServerTransport = (typeof MCP_SERVER_TRANSPORTS)[number];

export type McpServerInput = {
  name?: unknown;
  type?: unknown;
  command?: unknown;
  args?: unknown;
  env?: unknown;
  url?: unknown;
  is_active?: unknown;
};

export type NormalizedMcpServer = Omit<McpServerConfig, "created_at" | "updated_at"> & {
  created_at: string | null;
  updated_at: string | null;
};

function isMcpServerTransport(value: unknown): value is McpServerTransport {
  return MCP_SERVER_TRANSPORTS.some((transport) => transport === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readMcpString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function readMcpStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

export function readMcpStringRecord(value: unknown) {
  if (!isRecord(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, entryValue]) => [key.trim(), entryValue.trim()])
      .filter(([key]) => key.length > 0)
  );
}

export function readMcpUrl(value: unknown) {
  const raw = readMcpString(value);
  if (!raw || raw.length > 2048) return "";

  try {
    const url = new URL(raw);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || url.username || url.password) {
      return "";
    }
    return url.toString();
  } catch {
    return "";
  }
}

function readMcpToolCatalog(value: unknown): McpToolCatalogEntry[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (!isRecord(entry)) return [];

    const name = readMcpString(entry.name);
    const risk =
      entry.risk === "read" ||
      entry.risk === "write" ||
      entry.risk === "publish" ||
      entry.risk === "destructive"
        ? entry.risk
        : null;

    if (!name || !risk) return [];

    return [
      {
        name,
        description: readMcpString(entry.description),
        input_schema: isRecord(entry.input_schema) ? entry.input_schema : {},
        output_schema: isRecord(entry.output_schema) ? entry.output_schema : undefined,
        capabilities: readMcpStringArray(entry.capabilities),
        risk,
        approval_required: risk !== "read",
      },
    ];
  });
}

export function normalizeMcpTimestamp(value: unknown): string | null {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    try {
      const date = value.toDate();
      return date instanceof Date && Number.isFinite(date.getTime()) ? date.toISOString() : null;
    } catch {
      return null;
    }
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  }

  return null;
}

export function mcpTimestampSortValue(value: string | null | undefined) {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export function normalizeMcpServerDocument(
  id: string,
  data: Record<string, unknown>
): NormalizedMcpServer {
  const type = isMcpServerTransport(data.type) ? data.type : "sse";
  const healthStatus =
    data.health_status === "healthy" ||
    data.health_status === "degraded" ||
    data.health_status === "unreachable" ||
    data.health_status === "unknown"
      ? data.health_status
      : "unknown";
  const latencyMs =
    typeof data.latency_ms === "number" && Number.isFinite(data.latency_ms) && data.latency_ms >= 0
      ? data.latency_ms
      : undefined;

  return {
    id,
    user_id: readMcpString(data.user_id),
    name: readMcpString(data.name) || "MCP server",
    type,
    command: type === "stdio" ? readMcpString(data.command) || undefined : undefined,
    args: type === "stdio" ? readMcpStringArray(data.args) : [],
    env: type === "stdio" ? readMcpStringRecord(data.env) : {},
    url: type !== "stdio" ? readMcpUrl(data.url) || undefined : undefined,
    is_active: data.is_active !== false,
    capabilities: readMcpStringArray(data.capabilities),
    permissions: readMcpStringArray(data.permissions),
    tool_catalog: readMcpToolCatalog(data.tool_catalog),
    latency_ms: latencyMs,
    last_tested_at: normalizeMcpTimestamp(data.last_tested_at) ?? undefined,
    health_status: healthStatus,
    created_at: normalizeMcpTimestamp(data.created_at),
    updated_at: normalizeMcpTimestamp(data.updated_at),
  };
}

export function normalizeNewMcpServer(
  userId: string,
  input: McpServerInput,
  now: Date = new Date()
) {
  const name = readMcpString(input.name);
  const type = isMcpServerTransport(input.type) ? input.type : null;
  if (!name || !type) {
    return null;
  }

  const remoteUrl = type === "stdio" ? "" : readMcpUrl(input.url);
  const command = type === "stdio" ? readMcpString(input.command) : "";
  if (type === "stdio" && !command) return null;
  if (type !== "stdio" && !remoteUrl) return null;

  return {
    user_id: userId,
    name,
    type,
    command: type === "stdio" ? command : null,
    args: type === "stdio" ? readMcpStringArray(input.args) : [],
    env: type === "stdio" ? readMcpStringRecord(input.env) : {},
    url: type !== "stdio" ? remoteUrl : null,
    is_active: true,
    created_at: now,
    updated_at: now,
  };
}

export function sanitizeMcpServerUpdates(body: McpServerInput, now: Date = new Date()) {
  const updates: Record<string, unknown> = {};

  if (body.name !== undefined) {
    const name = readMcpString(body.name);
    if (name) updates.name = name;
  }

  if (isMcpServerTransport(body.type)) {
    updates.type = body.type;
  }

  if (body.command !== undefined) {
    updates.command = readMcpString(body.command) || null;
  }

  if (body.args !== undefined) {
    updates.args = readMcpStringArray(body.args);
  }

  if (body.env !== undefined) {
    updates.env = readMcpStringRecord(body.env);
  }

  if (body.url !== undefined) {
    updates.url = readMcpUrl(body.url) || null;
  }

  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  updates.updated_at = now;
  return updates;
}
