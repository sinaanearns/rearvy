import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { tool } from "ai";
import { jsonSchema } from "@ai-sdk/provider-utils";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, McpServerConfig } from "@/lib/firebase/schema";

export async function getMcpTools(userId: string, options: { isDesktopApp?: boolean } = {}) {
  const { isDesktopApp = false } = options;
  const mcpServersSnapshot = await adminDb
    .collection(COLLECTIONS.MCP_SERVERS)
    .where("user_id", "==", userId)
    .where("is_active", "==", true)
    .get();

  const configs = mcpServersSnapshot.docs.map(
    (doc) => ({ id: doc.id, ...doc.data() }) as McpServerConfig
  );

  const tools: Record<string, any> = {};

  async function callToolWithRetry(
    client: Client,
    toolName: string,
    args: any,
    maxAttempts = 3
  ) {
    let attempt = 0;
    let lastError: unknown = null;

    while (attempt < maxAttempts) {
      attempt += 1;
      try {
        const result = await client.callTool({
          name: toolName,
          arguments: args || {},
        });

        if (
          result &&
          typeof result === "object" &&
          "error" in result &&
          (result as Record<string, unknown>).error
        ) {
          lastError = (result as Record<string, unknown>).error;
          if (attempt >= maxAttempts) {
            return result;
          }

          console.warn(
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

        console.warn(
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

      let transport;
      if (config.type === "stdio") {
        // Stdio is only supported in local/desktop environments
        const isLocal = process.env.NODE_ENV === "development" || isDesktopApp;
        if (!isLocal) {
          console.warn(`Skipping stdio MCP server ${config.name} in production/web environment`);
          continue;
        }
        
        if (!config.command) continue;

        transport = new StdioClientTransport({
          command: config.command,
          args: config.args || [],
          env: { ...process.env, ...(config.env || {}) } as any,
        });
      } else if (config.type === "sse") {
        if (!config.url) continue;
        transport = new SSEClientTransport(new URL(config.url));
      } else {
        continue;
      }

      await client.connect(transport);
      const listResult = await client.listTools();
      const mcpTools = listResult.tools || [];

      for (const mcpTool of mcpTools) {
        // Prefix tool name to avoid collisions and make it identifiable
        // Clean name to be valid tool name (alphanumeric + underscores)
        const safeServerName = config.name.replace(/[^a-zA-Z0-9_]/g, "_").toLowerCase();
        const toolName = `mcp_${safeServerName}_${mcpTool.name}`;
        const inputSchema = mcpTool.inputSchema
          ? jsonSchema(mcpTool.inputSchema as any)
          : jsonSchema({ properties: {}, additionalProperties: false });
        
        tools[toolName] = tool({
          description: mcpTool.description || `Tool from MCP server ${config.name}`,
          inputSchema,
          execute: async (args: any) =>
            callToolWithRetry(client, mcpTool.name, args, 3),
        });
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
    }
  }

  return tools;
}
