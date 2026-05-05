import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, McpServerConfig } from "@/lib/firebase/schema";
import {
  normalizeDesktopMcpServers,
  type DesktopMcpConfig,
} from "@/lib/mcp-config";

const LOCAL_MCP_CONFIG_FILENAMES = [
  "rearvyconfigure.json",
  "rearvycofigure.json",
  "claude_desktop_config.json",
];

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readLocalDesktopMcpConfig(): Promise<DesktopMcpConfig | null> {
  for (const fileName of LOCAL_MCP_CONFIG_FILENAMES) {
    const filePath = path.join(os.homedir(), fileName);

    try {
      const raw = await fs.readFile(filePath, "utf8");
      const parsed = JSON.parse(raw);

      if (!isPlainObject(parsed)) {
        continue;
      }

      const servers = normalizeDesktopMcpServers(parsed as DesktopMcpConfig);
      if (!servers.length) {
        continue;
      }

      return parsed as DesktopMcpConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.warn(`Failed to read local MCP config from ${filePath}:`, error);
      }
    }
  }

  return null;
}

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

  const mergedConfigs: McpServerConfig[] = [];
  const seenConfigs = new Set<string>();

  const addConfig = (config: McpServerConfig) => {
    if (!config.name) {
      return;
    }

    const configKey = `${config.name.trim().toLowerCase()}::${config.type}`;
    if (seenConfigs.has(configKey)) {
      return;
    }

    seenConfigs.add(configKey);
    mergedConfigs.push(config);
  };

  const isLocal = process.env.NODE_ENV === "development" || isDesktopApp;
  if (isLocal) {
    const localDesktopConfig = await readLocalDesktopMcpConfig();
    const localServers = normalizeDesktopMcpServers(localDesktopConfig);

    for (const server of localServers) {
      addConfig({
        id: `local:${server.name}`,
        user_id: userId,
        name: server.name,
        type: server.type,
        command: server.command,
        args: server.args || [],
        env: server.env || {},
        url: server.url || null,
        is_active: true,
        created_at: new Date(),
        updated_at: new Date(),
      });
    }
  }

  for (const config of configs) {
    addConfig(config);
  }

  const tools: Record<string, any> = {};

  for (const config of mergedConfigs) {
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
