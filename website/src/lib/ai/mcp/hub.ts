import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { createFetchWithInit } from "@modelcontextprotocol/sdk/shared/transport.js";
import { jsonSchema, tool, type ToolSet } from "ai";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, McpServerConfig } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

type McpToolArguments = Record<string, unknown>;
type AiJsonSchemaInput = Parameters<typeof jsonSchema>[0];
const log = createServerLogger("McpHub");

const EMPTY_TOOL_INPUT_SCHEMA: AiJsonSchemaInput = {
  type: "object",
  properties: {},
  additionalProperties: false,
};

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

function toMcpToolArguments(args: unknown): McpToolArguments {
  if (!args || typeof args !== "object" || Array.isArray(args)) {
    return {};
  }

  return args as McpToolArguments;
}

export async function getMcpTools(
  userId: string,
  options: { isDesktopApp?: boolean; allowedServerIds?: string[] | null } = {}
) {
  const { isDesktopApp = false, allowedServerIds = null } = options;
  // Desktop runtime may run with NODE_ENV=production while still being a local,
  // trusted environment where stdio MCP servers are expected to work.
  const canRunLocalStdioServers =
    process.env.NODE_ENV === "development" || isDesktopApp;
  const mcpServersSnapshot = await adminDb
    .collection(COLLECTIONS.MCP_SERVERS)
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .get();

  const allowedServerIdSet = Array.isArray(allowedServerIds)
    ? new Set(allowedServerIds)
    : null;
  const configs = mcpServersSnapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as McpServerConfig)
    .filter((config) => (allowedServerIdSet ? allowedServerIdSet.has(config.id) : true));

  const tools: ToolSet = {};

  async function callToolWithRetry(
    client: Client,
    toolName: string,
    args: McpToolArguments,
    maxAttempts = 3
  ) {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await client.callTool({
          name: toolName,
          arguments: args,
        });

        if (
          result &&
          typeof result === "object" &&
          "error" in result &&
          (result as Record<string, unknown>).error
        ) {
          lastError = (result as Record<string, unknown>).error;
          if (attempt >= maxAttempts) {
            throw new Error(`MCP tool ${toolName} failed: ${lastError}`);
          }

          log.warn(
            `MCP tool ${toolName} attempt ${attempt} returned error; retrying...`,
            lastError
          );
          await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
          continue;
        }

        return result;
      } catch (error) {
        lastError = error;
        if (attempt >= maxAttempts) {
          throw error;
        }

        log.warn(
          `MCP tool ${toolName} attempt ${attempt} failed; retrying...`,
          error
        );
        await new Promise((resolve) => setTimeout(resolve, 500 * attempt));
      }
    }

    throw lastError;
  }

  for (const config of configs) {
    try {
      const client = new Client(
        { name: "Rearvy-MCP-Hub", version: "1.0.0" },
        { capabilities: {} }
      );

      let transport: StdioClientTransport | SSEClientTransport;
      if (config.type === "stdio") {
        // Stdio is only supported in local/desktop environments.
        // Web/serverless production should keep this disabled.
        if (!canRunLocalStdioServers) {
          log.warn(`Skipping stdio MCP server ${config.name} in production/web environment`);
          continue;
        }
        
        if (!config.command) continue;

        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: buildStdioEnv(config.env),
        });
      } else if (config.type === "sse") {
        if (!config.url) continue;
        const useNgrokBypassHeader = isNgrokFreeAppUrl(config.url);
        const requestInit = useNgrokBypassHeader
          ? {
              headers: {
                "ngrok-skip-browser-warning": "true",
              },
            }
          : undefined;

        if (useNgrokBypassHeader) {
          log.debug(`Adding ngrok browser-warning bypass header for '${config.name}'`);
        }

        transport = new SSEClientTransport(new URL(config.url),
          requestInit
            ? {
                requestInit,
                fetch: createFetchWithInit(undefined, requestInit),
              }
            : undefined
        );
      } else {
        continue;
      }

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
          execute: async (args) =>
            callToolWithRetry(client, mcpTool.name, toMcpToolArguments(args), 3),
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
