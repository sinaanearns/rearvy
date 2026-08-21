import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { createFetchWithInit } from "@modelcontextprotocol/sdk/shared/transport.js";
import { jsonSchema, tool, type ToolSet } from "ai";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type McpServerConfig } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { normalizeMcpServerDocument } from "./server-config";

type McpToolArguments = Record<string, unknown>;
type AiJsonSchemaInput = Parameters<typeof jsonSchema>[0];
const log = createServerLogger("McpHub");

const EMPTY_TOOL_INPUT_SCHEMA: AiJsonSchemaInput = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

type McpClientTransport =
  | StdioClientTransport
  | SSEClientTransport
  | StreamableHTTPClientTransport;

function isNgrokFreeAppUrl(rawUrl?: string | null): boolean {
  if (!rawUrl) {
    return false;
  }

  try {
    return new URL(rawUrl).hostname.toLowerCase().endsWith(".ngrok-free.app");
  } catch (error) {
    log.debug("Ignoring invalid MCP URL while checking ngrok host:", error);
    return false;
  }
}

function buildStdioEnv(overrides?: Record<string, string>): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === "string") {
      env[key] = value;
    }
  }

  return { ...env, ...(overrides || {}) };
}

function buildRemoteTransportOptions(rawUrl: string) {
  const useNgrokBypassHeader = isNgrokFreeAppUrl(rawUrl);
  const requestInit = useNgrokBypassHeader
    ? {
        headers: {
          "ngrok-skip-browser-warning": "true",
        },
      }
    : undefined;

  return requestInit
    ? {
        requestInit,
        fetch: createFetchWithInit(undefined, requestInit),
      }
    : undefined;
}

export function isPrivateOrLocalMcpHostname(rawHostname: string) {
  const hostname = rawHostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (hostname === "localhost" || hostname.endsWith(".localhost")) return true;
  if (hostname === "::1" || hostname.startsWith("fc") || hostname.startsWith("fd") || hostname.startsWith("fe80:")) {
    return true;
  }

  const octets = hostname.split(".").map((part) => Number(part));
  if (octets.length !== 4 || octets.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return false;
  }

  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    first >= 224
  );
}

function createMcpTransport(
  config: Pick<McpServerConfig, "name" | "type" | "command" | "args" | "env" | "url">,
  canRunLocalStdioServers: boolean
): McpClientTransport {
  if (config.type === "stdio") {
    if (!canRunLocalStdioServers) {
      throw new Error(`Local MCP server '${config.name}' requires Rearvy Desktop.`);
    }
    if (!config.command) throw new Error("Missing stdio command");
    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: buildStdioEnv(config.env),
    });
  }

  if (!config.url) throw new Error(`Missing ${config.type} URL`);
  const url = new URL(config.url);
  if (!canRunLocalStdioServers && url.protocol !== "https:") {
    throw new Error(`Remote MCP connector '${config.name}' must use HTTPS.`);
  }
  if (!canRunLocalStdioServers && isPrivateOrLocalMcpHostname(url.hostname)) {
    throw new Error(`Remote MCP connector '${config.name}' cannot target a local or private address.`);
  }
  const options = buildRemoteTransportOptions(config.url);

  if (config.type === "streamable_http") {
    return new StreamableHTTPClientTransport(url, options);
  }
  return new SSEClientTransport(url, options);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function toMcpToolArguments(args: unknown): McpToolArguments {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(args).filter(([key]) => key.trim().length > 0)
  );
}

export function readMcpToolResultError(result: unknown) {
  if (!isRecord(result)) {
    return null;
  }

  if (result.error) {
    return result.error;
  }

  if (result.isError === true) {
    if (Array.isArray(result.content)) {
      const textItem = result.content.find(
        (c: unknown) => isRecord(c) && typeof c.text === "string"
      );
      if (textItem && isRecord(textItem) && typeof textItem.text === "string") {
        return textItem.text;
      }
    }
    return "MCP tool returned isError: true";
  }

  return null;
}

function isNonRetryableMcpError(error: unknown): boolean {
  const text = String(error).toLowerCase();
  return (
    text.includes("rate limit") ||
    text.includes("too many requests") ||
    text.includes("429") ||
    text.includes("401") ||
    text.includes("unauthorized") ||
    text.includes("422") ||
    text.includes("validation") ||
    text.includes("invalid") ||
    text.includes("iserror") ||
    text.includes("32603") ||
    text.includes("user:@me")
  );
}

async function callToolWithRetry(
  client: Client,
  toolName: string,
  args: McpToolArguments,
  maxAttempts = 1,
  timeoutMs = 30_000
) {
  let attempt = 0;
  let lastError: unknown = null;

  while (attempt < maxAttempts) {
    attempt += 1;
    try {
      const result = await client.callTool(
        {
          name: toolName,
          arguments: args,
        },
        undefined,
        { timeout: timeoutMs }
      );

      const resultError = readMcpToolResultError(result);
      if (resultError) {
        lastError = resultError;
        if (attempt >= maxAttempts || isNonRetryableMcpError(resultError)) {
          throw new Error(`MCP tool ${toolName} failed: ${String(lastError)}`);
        }

        log.warn(
          `MCP tool ${toolName} attempt ${attempt} returned error; retrying...`,
          lastError
        );
        await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        continue;
      }

      return result;
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || isNonRetryableMcpError(error)) {
        throw error;
      }

      log.warn(`MCP tool ${toolName} attempt ${attempt} failed; retrying...`, error);
      await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
    }
  }

  throw lastError;
}

export async function getMcpTools(
  userId: string,
  options: { isDesktopApp?: boolean; allowedServerIds?: string[] | null } = {}
) {
  const { isDesktopApp = false, allowedServerIds = null } = options;
  // Desktop runtime may run with NODE_ENV=production while still being a local,
  // trusted environment where stdio MCP servers are expected to work.
  const canRunLocalStdioServers =
    process.env.NODE_ENV === "development" || process.env.REARVY_TRUSTED_LOCAL_RUNTIME === "1";
  const mcpServersSnapshot = await adminDb
    .collection(COLLECTIONS.MCP_SERVERS)
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .get();

  const allowedServerIdSet = Array.isArray(allowedServerIds)
    ? new Set(allowedServerIds)
    : null;
  const configs = mcpServersSnapshot.docs
    .map((doc) => normalizeMcpServerDocument(doc.id, doc.data()))
    .filter((config) => (allowedServerIdSet ? allowedServerIdSet.has(config.id) : true));

  const tools: ToolSet = {};

  for (const config of configs) {
    try {
      const client = new Client(
        { name: "Rearvy-MCP-Hub", version: "1.0.0" },
        { capabilities: {} }
      );

      const transport = createMcpTransport(config, canRunLocalStdioServers);

      await client.connect(transport);
      const listResult = await client.listTools();
      const mcpTools = listResult.tools || [];
      log.debug(`Connected to '${config.name}', loaded ${mcpTools.length} tools`);

      for (const mcpTool of mcpTools) {
        // Prefix tool name to avoid collisions and make it identifiable
        // Clean name to be valid tool name (alphanumeric + underscores)
        const safeServerName = config.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
        const toolName = `mcp_${safeServerName}_${mcpTool.name}`;
        const inputSchema = mcpTool.inputSchema
          ? jsonSchema(mcpTool.inputSchema as AiJsonSchemaInput)
          : jsonSchema(EMPTY_TOOL_INPUT_SCHEMA);
        
        tools[toolName] = tool({
          description: mcpTool.description || `Tool from MCP server ${config.name}`,
          inputSchema,
          execute: async (args) => {
            try {
              return await callToolWithRetry(client, mcpTool.name, toMcpToolArguments(args), 3);
            } catch (error) {
              const errorMessage = error instanceof Error ? error.message : String(error);
              log.error(`MCP tool ${toolName} execution error:`, error);
              const isRateLimit = /rate\s*limit|too\s*many\s*requests|429/i.test(errorMessage);
              const isAuthError = /401|unauthorized|bad\s*credentials|token/i.test(errorMessage);

              let userHelp = "";
              if (isRateLimit) {
                userHelp = ` The '${config.name}' connector is rate limited. Wait before retrying or review that connector's usage limits.`;
              } else if (isAuthError) {
                userHelp = ` The '${config.name}' connector needs to be reconnected or given valid credentials.`;
              } else {
                userHelp = ` Review the '${config.name}' connector input and health status before retrying.`;
              }

              return {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `MCP tool '${mcpTool.name}' failed: ${errorMessage}.${userHelp}`,
                  },
                ],
              };
            }
          },
        });
      }
    } catch (error) {
      log.error(`Failed to connect to MCP server '${config.name}':`, error);
    }
  }

  const toolCount = Object.keys(tools).length;
  log.debug(`Hub initialization complete: ${toolCount} total MCP tools available for ${isDesktopApp ? "desktop" : "web"} mode`);
  return tools;
}

export interface InvokeMcpToolRequest {
  userId: string;
  serverId: string;
  toolName: string;
  arguments: Record<string, unknown>;
  isDesktopApp?: boolean;
  timeoutMs?: number;
  maxAttempts?: number;
}

export interface InvokeMcpToolResult {
  serverId: string;
  serverName: string;
  toolName: string;
  output: Record<string, unknown>;
  durationMs: number;
}

/**
 * Executes one concrete MCP operation. Ownership, connection status, live tool
 * discovery, MCP error results, timeouts, and cleanup are enforced here so a
 * workflow cannot report model-generated text as connector success.
 */
export async function invokeMcpTool(
  request: InvokeMcpToolRequest
): Promise<InvokeMcpToolResult> {
  const startedAt = Date.now();
  const serverDoc = await adminDb
    .collection(COLLECTIONS.MCP_SERVERS)
    .doc(request.serverId)
    .get();

  if (!serverDoc.exists) throw new Error("The assigned MCP connector no longer exists.");

  const config = normalizeMcpServerDocument(serverDoc.id, serverDoc.data() || {});
  if (config.user_id !== request.userId) {
    throw new Error("The assigned MCP connector does not belong to this user.");
  }
  if (!config.is_active) throw new Error(`The '${config.name}' connector is disabled.`);

  const canRunLocalStdioServers =
    process.env.NODE_ENV === "development" || process.env.REARVY_TRUSTED_LOCAL_RUNTIME === "1";
  const client = new Client(
    { name: "Rearvy-Connector-Executor", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    await client.connect(createMcpTransport(config, canRunLocalStdioServers));
    const listResult = await client.listTools();
    const liveTool = (listResult.tools || []).find((candidate) => candidate.name === request.toolName);
    if (!liveTool) {
      throw new Error(
        `Operation '${request.toolName}' is no longer exposed by '${config.name}'. Test the connector again to refresh its capabilities.`
      );
    }

    const output = await callToolWithRetry(
      client,
      liveTool.name,
      toMcpToolArguments(request.arguments),
      request.maxAttempts ?? 1,
      request.timeoutMs ?? 30_000
    );

    return {
      serverId: config.id,
      serverName: config.name,
      toolName: liveTool.name,
      output: output as Record<string, unknown>,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    try {
      await client.close();
    } catch (closeError) {
      log.warn(`Failed to close MCP connector '${config.name}' cleanly:`, closeError);
    }
  }
}

export async function testMcpServerConnection(config: {
  id?: string;
  name: string;
  type: "stdio" | "sse" | "streamable_http";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
}): Promise<{
  success: boolean;
  latency_ms: number;
  tools: Array<{
    name: string;
    description: string;
    input_schema: Record<string, unknown>;
    output_schema?: Record<string, unknown>;
    capabilities: string[];
    risk: "read" | "write" | "publish" | "destructive";
    approval_required: boolean;
  }>;
  capabilities: string[];
  error?: string;
}> {
  const startTime = Date.now();
  let client: Client | null = null;
  try {
    client = new Client(
      { name: "Rearvy-MCP-Tester", version: "1.0.0" },
      { capabilities: {} }
    );

    const transport = createMcpTransport(config, true);

    await client.connect(transport);
    const listResult = await client.listTools();
    const latency_ms = Date.now() - startTime;
    const mcpTools = listResult.tools || [];

    const { extractCapabilitiesFromMcpTool, inferMcpToolRisk } = await import(
      "./capability-graph"
    );

    const toolsWithCaps = mcpTools.map((t) => {
      const caps = extractCapabilitiesFromMcpTool(t.name, t.description || "");
      const risk = inferMcpToolRisk(t.name, t.description || "");
      return {
        name: t.name,
        description: t.description || "",
        input_schema: (t.inputSchema || {}) as Record<string, unknown>,
        output_schema: t.outputSchema as Record<string, unknown> | undefined,
        capabilities: caps,
        risk,
        approval_required: risk !== "read",
      };
    });

    const allCapabilities = Array.from(
      new Set(toolsWithCaps.flatMap((t) => t.capabilities))
    );

    return {
      success: true,
      latency_ms,
      tools: toolsWithCaps,
      capabilities: allCapabilities,
    };
  } catch (error) {
    const latency_ms = Date.now() - startTime;
    return {
      success: false,
      latency_ms,
      tools: [],
      capabilities: [],
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        log.warn("Failed to close MCP test client cleanly:", closeError);
      }
    }
  }
}
