import type { McpServerConfig } from "@/lib/firebase/schema";

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
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, entryValue]) => [key.trim(), entryValue.trim()])
      .filter(([key]) => key.length > 0)
  );
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
  const type = data.type === "stdio" || data.type === "sse" ? data.type : "sse";

  return {
    id,
    user_id: readMcpString(data.user_id),
    name: readMcpString(data.name) || "MCP server",
    type,
    command: type === "stdio" ? readMcpString(data.command) || undefined : undefined,
    args: type === "stdio" ? readMcpStringArray(data.args) : [],
    env: type === "stdio" ? readMcpStringRecord(data.env) : {},
    url: type === "sse" ? readMcpString(data.url) || undefined : undefined,
    is_active: data.is_active !== false,
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
  const type = input.type === "stdio" || input.type === "sse" ? input.type : null;
  if (!name || !type) {
    return null;
  }

  return {
    user_id: userId,
    name,
    type,
    command: type === "stdio" ? readMcpString(input.command) || null : null,
    args: type === "stdio" ? readMcpStringArray(input.args) : [],
    env: type === "stdio" ? readMcpStringRecord(input.env) : {},
    url: type === "sse" ? readMcpString(input.url) || null : null,
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

  if (body.type === "stdio" || body.type === "sse") {
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
    updates.url = readMcpString(body.url) || null;
  }

  if (typeof body.is_active === "boolean") {
    updates.is_active = body.is_active;
  }

  updates.updated_at = now;
  return updates;
}
