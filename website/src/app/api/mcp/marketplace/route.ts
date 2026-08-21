import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS, type MarketplaceApp } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("ApiMcpMarketplace");

const DEFAULT_MARKETPLACE_APPS: MarketplaceApp[] = [
  {
    id: "app_filesystem",
    title: "Filesystem MCP Server",
    description: "Provide AI agents secure read and write access to designated local directory files and project assets.",
    category: "Productivity",
    icon_name: "Folder",
    capabilities: ["documents", "storage"],
    mcp_config_template: {
      name: "Filesystem MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_postgres",
    title: "PostgreSQL MCP Server",
    description: "Enable AI agents to inspect database schemas, execute read-only queries, and analyze SQL business data.",
    category: "Development",
    icon_name: "Database",
    capabilities: ["database", "analytics"],
    mcp_config_template: {
      name: "Postgres MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-postgres"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_sqlite",
    title: "SQLite MCP Server",
    description: "Query and manage local SQLite relational databases directly from AI reasoning workflows.",
    category: "Development",
    icon_name: "Database",
    capabilities: ["database"],
    mcp_config_template: {
      name: "SQLite MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sqlite"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_fetch",
    title: "Web Fetch & Scraper MCP",
    description: "Fetch web pages, convert web HTML to formatted Markdown, and extract unstructured web data.",
    category: "Analytics",
    icon_name: "Globe",
    capabilities: ["search", "browser_automation"],
    mcp_config_template: {
      name: "Fetch MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-fetch"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_github",
    title: "GitHub MCP Server",
    description: "Search repositories, create and manage issues, review pull requests, and automate git workflows.",
    category: "Development",
    icon_name: "GitBranch",
    capabilities: ["development"],
    mcp_config_template: {
      name: "GitHub MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-github"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_gdrive",
    title: "Google Drive MCP Server",
    description: "Search, inspect, and extract information from Google Drive documents, spreadsheets, and files.",
    category: "Productivity",
    icon_name: "FileText",
    capabilities: ["documents", "storage"],
    mcp_config_template: {
      name: "Google Drive MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-gdrive"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: false,
  },
  {
    id: "app_slack",
    title: "Slack Workspace MCP Server",
    description: "Send channel notifications, post updates, and inspect team messages inside Slack workspaces.",
    category: "Support",
    icon_name: "MessageSquare",
    capabilities: ["email"],
    mcp_config_template: {
      name: "Slack MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-slack"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: false,
  },
  {
    id: "app_puppeteer",
    title: "Puppeteer Automation MCP",
    description: "Control headless browsers, take full-page screenshots, fill out forms, and automate complex web interactions.",
    category: "Development",
    icon_name: "Monitor",
    capabilities: ["browser_automation"],
    mcp_config_template: {
      name: "Puppeteer MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-puppeteer"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_sequential_thinking",
    title: "Sequential Thinking MCP",
    description: "Provide dynamic multi-step problem solving and structured plan refinement for complex AI agent tasks.",
    category: "AI",
    icon_name: "Brain",
    capabilities: ["development", "analytics"],
    mcp_config_template: {
      name: "Sequential Thinking MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-sequential-thinking"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: true,
  },
  {
    id: "app_memory",
    title: "Memory Graph MCP",
    description: "Maintain a structured graph memory of entities, facts, and business concepts across chat sessions.",
    category: "AI",
    icon_name: "Cpu",
    capabilities: ["crm", "documents"],
    mcp_config_template: {
      name: "Memory Graph MCP",
      type: "stdio",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-memory"],
    },
    author: "Model Context Protocol",
    installs_count: 0,
    rating: 5.0,
    featured: false,
  },
];

export async function GET() {
  try {
    return NextResponse.json({ apps: DEFAULT_MARKETPLACE_APPS });
  } catch (error) {
    log.error("Marketplace GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const action = typeof body.action === "string" ? body.action : "install";

    // Handle User Review Submission
    if (action === "submit_review") {
      const appId = typeof body.appId === "string" ? body.appId : null;
      const comment = typeof body.comment === "string" ? body.comment.trim() : "";
      const rating = typeof body.rating === "number" ? body.rating : 5;

      if (!appId || !comment) {
        return NextResponse.json({ error: "App ID and comment are required" }, { status: 400 });
      }

      const app = DEFAULT_MARKETPLACE_APPS.find((a) => a.id === appId);
      if (!app) {
        return NextResponse.json({ error: "App not found" }, { status: 404 });
      }

      const newReview = {
        id: `rev_${Date.now()}`,
        author: user.email ? user.email.split("@")[0] : "Verified User",
        rating,
        comment,
        date: new Date().toISOString().split("T")[0],
      };

      if (!app.reviews) app.reviews = [];
      app.reviews.unshift(newReview);

      return NextResponse.json({
        success: true,
        review: newReview,
        message: "Review submitted directly to the app integration!",
      });
    }

    // Handle App Installation
    const appId = typeof body.appId === "string" ? body.appId : null;
    if (!appId) {
      return NextResponse.json({ error: "App ID is required" }, { status: 400 });
    }

    const app = DEFAULT_MARKETPLACE_APPS.find((a) => a.id === appId);
    if (!app) {
      return NextResponse.json({ error: "App not found" }, { status: 404 });
    }

    const now = new Date();
    const newServer = {
      user_id: user.uid,
      name: app.mcp_config_template.name,
      type: app.mcp_config_template.type,
      command: app.mcp_config_template.command || null,
      args: app.mcp_config_template.args || [],
      url: app.mcp_config_template.url || null,
      capabilities: app.capabilities,
      is_active: true,
      health_status: "healthy",
      created_at: now,
      updated_at: now,
    };

    const docRef = await adminDb.collection(COLLECTIONS.MCP_SERVERS).add(newServer);

    return NextResponse.json({
      success: true,
      serverId: docRef.id,
      server: newServer,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("Marketplace install POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
