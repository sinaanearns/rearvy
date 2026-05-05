export type DesktopMcpTransport = "stdio" | "sse";

export type DesktopMcpServerConfig = {
  name: string;
  type: DesktopMcpTransport;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
};

export type DesktopMcpConfig = {
  mcpServers?: Record<string, unknown>;
  mcp_servers?: Array<Partial<DesktopMcpServerConfig>>;
  servers?: Array<Partial<DesktopMcpServerConfig>>;
  preferences?: Record<string, unknown>;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeArgs(args: unknown): string[] {
  if (!Array.isArray(args)) {
    return [];
  }

  return args
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);
}

function normalizeEnv(env: unknown): Record<string, string> | undefined {
  if (!isPlainObject(env)) {
    return undefined;
  }

  const entries = Object.entries(env)
    .filter((entry): entry is [string, string] => typeof entry[1] === "string")
    .map(([key, value]) => [key, value.trim()] as const)
    .filter(([, value]) => value.length > 0);

  if (!entries.length) {
    return undefined;
  }

  return Object.fromEntries(entries);
}

function normalizeServer(
  name: string,
  server: Record<string, unknown>
): DesktopMcpServerConfig | null {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return null;
  }

  const command =
    typeof server.command === "string" && server.command.trim().length > 0
      ? server.command.trim()
      : undefined;
  const url =
    typeof server.url === "string" && server.url.trim().length > 0
      ? server.url.trim()
      : undefined;
  const args = normalizeArgs(server.args);
  const env = normalizeEnv(server.env);

  return {
    name: trimmedName,
    type: server.type === "sse" || url ? "sse" : "stdio",
    ...(command ? { command } : {}),
    ...(args.length ? { args } : {}),
    ...(env ? { env } : {}),
    ...(url ? { url } : {}),
  };
}

export function normalizeDesktopMcpServers(
  config?: DesktopMcpConfig | null
): DesktopMcpServerConfig[] {
  if (!config) {
    return [];
  }

  if (isPlainObject(config.mcpServers)) {
    return Object.entries(config.mcpServers)
      .map(([name, server]) =>
        normalizeServer(name, isPlainObject(server) ? server : {})
      )
      .filter((server): server is DesktopMcpServerConfig => Boolean(server));
  }

  if (Array.isArray(config.mcp_servers)) {
    return config.mcp_servers
      .map((server) =>
        normalizeServer(server.name ?? "", isPlainObject(server) ? server : {})
      )
      .filter((server): server is DesktopMcpServerConfig => Boolean(server));
  }

  if (Array.isArray(config.servers)) {
    return config.servers
      .map((server) =>
        normalizeServer(server.name ?? "", isPlainObject(server) ? server : {})
      )
      .filter((server): server is DesktopMcpServerConfig => Boolean(server));
  }

  return [];
}

export function buildDesktopMcpConfig(
  servers: DesktopMcpServerConfig[],
  preferences?: Record<string, unknown>
): DesktopMcpConfig {
  const normalizedServers = servers
    .map((server) => normalizeServer(server.name, server))
    .filter((server): server is DesktopMcpServerConfig => Boolean(server));

  const mcpServers = Object.fromEntries(
    normalizedServers.map((server) => [
      server.name,
      {
        type: server.type,
        ...(server.command ? { command: server.command } : {}),
        ...(server.args?.length ? { args: server.args } : {}),
        ...(server.env && Object.keys(server.env).length ? { env: server.env } : {}),
        ...(server.url ? { url: server.url } : {}),
      },
    ])
  );

  const config: DesktopMcpConfig = { mcpServers };

  if (preferences && Object.keys(preferences).length > 0) {
    config.preferences = preferences;
  }

  return config;
}