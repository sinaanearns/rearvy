import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("McpKeysApi");

type ServiceTemplate = {
  name: string;
  command: string;
  args: string[];
  defaultEnvKey: string;
};

const SERVICE_TEMPLATES: Record<string, ServiceTemplate> = {
  github: {
    name: "GitHub MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    defaultEnvKey: "GITHUB_PERSONAL_ACCESS_TOKEN",
  },
  app_github: {
    name: "GitHub MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    defaultEnvKey: "GITHUB_PERSONAL_ACCESS_TOKEN",
  },
  slack: {
    name: "Slack Workspace MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    defaultEnvKey: "SLACK_BOT_TOKEN",
  },
  app_slack: {
    name: "Slack Workspace MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-slack"],
    defaultEnvKey: "SLACK_BOT_TOKEN",
  },
  postgres: {
    name: "PostgreSQL MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    defaultEnvKey: "POSTGRES_CONNECTION_STRING",
  },
  app_postgres: {
    name: "PostgreSQL MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres"],
    defaultEnvKey: "POSTGRES_CONNECTION_STRING",
  },
  sqlite: {
    name: "SQLite MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    defaultEnvKey: "SQLITE_DB_PATH",
  },
  app_sqlite: {
    name: "SQLite MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sqlite"],
    defaultEnvKey: "SQLITE_DB_PATH",
  },
  gdrive: {
    name: "Google Drive MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    defaultEnvKey: "GDRIVE_API_KEY",
  },
  app_gdrive: {
    name: "Google Drive MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-gdrive"],
    defaultEnvKey: "GDRIVE_API_KEY",
  },
  filesystem: {
    name: "Filesystem MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    defaultEnvKey: "ALLOWED_DIRECTORY",
  },
  app_filesystem: {
    name: "Filesystem MCP Server",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-filesystem"],
    defaultEnvKey: "ALLOWED_DIRECTORY",
  },
  fetch: {
    name: "Web Fetch & Scraper MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    defaultEnvKey: "USER_AGENT_TOKEN",
  },
  app_fetch: {
    name: "Web Fetch & Scraper MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-fetch"],
    defaultEnvKey: "USER_AGENT_TOKEN",
  },
  puppeteer: {
    name: "Puppeteer Automation MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    defaultEnvKey: "PUPPETEER_EXECUTABLE_PATH",
  },
  app_puppeteer: {
    name: "Puppeteer Automation MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    defaultEnvKey: "PUPPETEER_EXECUTABLE_PATH",
  },
  sequential_thinking: {
    name: "Sequential Thinking MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    defaultEnvKey: "THINKING_MAX_STEPS",
  },
  app_sequential_thinking: {
    name: "Sequential Thinking MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    defaultEnvKey: "THINKING_MAX_STEPS",
  },
  memory: {
    name: "Memory Graph MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    defaultEnvKey: "MEMORY_FILE_PATH",
  },
  app_memory: {
    name: "Memory Graph MCP",
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-memory"],
    defaultEnvKey: "MEMORY_FILE_PATH",
  },
};

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const serviceInput = typeof body.service === "string" ? body.service.trim() : "github";
    const serviceKey = serviceInput.toLowerCase();
    const action = typeof body.action === "string" ? body.action.trim() : "save";
    const apiKey = typeof body.apiKey === "string" ? body.apiKey.trim() : "";
    const customEnvKey = typeof body.envKey === "string" ? body.envKey.trim() : "";
    const customEnvObject =
      body.env && typeof body.env === "object" && !Array.isArray(body.env)
        ? (body.env as Record<string, string>)
        : null;

    const template = SERVICE_TEMPLATES[serviceKey] || {
      name: `${serviceInput.toUpperCase()} MCP Server`,
      command: "npx",
      args: ["-y", `@modelcontextprotocol/server-${serviceKey.replace(/^app_/, "")}`],
      defaultEnvKey: customEnvKey || "API_KEY",
    };

    const targetEnvKey = customEnvKey || template.defaultEnvKey;

    if (action === "save" && !apiKey && !customEnvObject) {
      return NextResponse.json({ error: "API Key or Environment Configuration cannot be empty" }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", user.uid)
      .get();

    if (action === "clear_all") {
      const batch = adminDb.batch();
      snapshot.docs.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();
      log.info(`Cleared all MCP servers for user ${user.uid}`);
      return NextResponse.json({
        success: true,
        message: "All saved MCP credentials and integrations removed successfully.",
      });
    }

    const existingDoc = snapshot.docs.find((doc) => {
      const data = doc.data();
      const docName = (data.name || "").toLowerCase();
      const docCmd = (data.command || "").toLowerCase();
      const docArgs = Array.isArray(data.args) ? data.args.join(" ").toLowerCase() : "";
      const searchPattern = serviceKey.replace(/^app_/, "");
      return (
        docName.includes(searchPattern) ||
        docCmd.includes(searchPattern) ||
        docArgs.includes(searchPattern)
      );
    });

    const now = new Date().toISOString();

    if (existingDoc) {
      const existingData = existingDoc.data();
      let updatedEnv: Record<string, string> = { ...(existingData.env || {}) };

      if (action === "clear") {
        if (targetEnvKey) {
          delete updatedEnv[targetEnvKey];
        } else {
          updatedEnv = {};
        }

        if (Object.keys(updatedEnv).length === 0) {
          await existingDoc.ref.delete();
          log.info(`Deleted MCP server ${existingDoc.id} for user ${user.uid} as env is empty`);
          return NextResponse.json({
            success: true,
            serverId: existingDoc.id,
            env: {},
            message: `${template.name} credentials and server removed successfully.`,
          });
        }
      } else {
        if (customEnvObject) {
          updatedEnv = { ...updatedEnv, ...customEnvObject };
        } else if (apiKey) {
          updatedEnv[targetEnvKey] = apiKey;
        }
      }

      await existingDoc.ref.update({
        env: updatedEnv,
        is_active: Object.keys(updatedEnv).length > 0 || existingData.is_active !== false,
        health_status: "healthy",
        updated_at: now,
      });

      log.info(`Updated MCP API keys for user ${user.uid} in server ${existingDoc.id}`);
      return NextResponse.json({
        success: true,
        serverId: existingDoc.id,
        env: updatedEnv,
        message: `${template.name} credentials updated successfully.`,
      });
    }

    // Creating new MCP server if none exists
    const initialEnv: Record<string, string> = customEnvObject
      ? customEnvObject
      : apiKey
      ? { [targetEnvKey]: apiKey }
      : {};

    const newServer = {
      user_id: user.uid,
      name: template.name,
      type: "stdio",
      command: template.command,
      args: template.args,
      env: initialEnv,
      is_active: true,
      capabilities: ["development", "mcp"],
      health_status: "healthy",
      created_at: now,
      updated_at: now,
    };

    const docRef = await adminDb.collection(COLLECTIONS.MCP_SERVERS).add(newServer);
    log.info(`Created new MCP server ${docRef.id} for user ${user.uid}`);

    return NextResponse.json({
      success: true,
      serverId: docRef.id,
      env: initialEnv,
      message: `${template.name} created and configured with credentials.`,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("MCP keys POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

