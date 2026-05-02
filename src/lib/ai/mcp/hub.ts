import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
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
        
        tools[toolName] = {
          description: mcpTool.description || `Tool from MCP server ${config.name}`,
          parameters: mcpTool.inputSchema as any,
          execute: async (args: any) => {
            const result = await client.callTool({
              name: mcpTool.name,
              arguments: args,
            });
            return result;
          },
        };
      }
    } catch (error) {
      console.error(`Failed to connect to MCP server ${config.name}:`, error);
    }
  }

  return tools;
}
