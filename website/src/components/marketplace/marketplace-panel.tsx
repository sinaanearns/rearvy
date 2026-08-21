"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Search,
  Download,
  Loader2,
  Layers,
  Sparkles,
  CheckCircle2,
  Plug,
  ServerOff,
  TrendingUp,
  Zap,
  LayoutGrid,
  Lightbulb,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Package,
  Key,
  Eye,
  EyeOff,
  Trash2,
  Lock,
  Folder,
  Globe,
  Monitor,
  Brain,
  Cpu,
  Server,
} from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ─── App Logos ────────────────────────────────────────────────────────────────

function GithubLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cn("fill-current text-foreground", className)} viewBox="0 0 24 24">
      <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}

function PostgresLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cn("fill-current text-[#336791] dark:text-[#4183c4]", className)} viewBox="0 0 24 24">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.8 14.7c-2.3.4-4.8-.4-6.3-2.1-1.7-1.9-1.8-4.7-.3-6.8 1.4-1.9 3.8-2.8 6.1-2.4 1.8.3 3.4 1.4 4.3 3 .6 1.1.9 2.4.7 3.7-.2 1.8-1.3 3.4-2.8 4.3-.5.2-1.1.3-1.7.3zM12 7.5c-2.5 0-4.5 2-4.5 4.5s2 4.5 4.5 4.5 4.5-2 4.5-4.5-2-4.5-4.5-4.5z"/>
    </svg>
  );
}

function SqliteLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={cn("text-[#003B57] dark:text-[#4298B8]", className)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="6" rx="8" ry="3" />
      <path d="M4 6v6c0 1.66 3.58 3 8 3s8-1.34 8-3V6" />
      <path d="M4 12v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}

function GdriveLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 87.3 78">
      <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
      <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z" fill="#00ac47"/>
      <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.5l5.85 10.15z" fill="#ea4335"/>
      <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
      <path d="m59.8 53h27.5c0-1.55-.4-3.1-1.2-4.5l-13.75-23.8-13.75 23.8z" fill="#ffba00"/>
      <path d="m43.65 25 13.75 23.8-13.75 23.8-13.75-23.8z" fill="#2684fc"/>
    </svg>
  );
}

function SlackLogo({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 127 127">
      <path d="M27.3 80c0 7.3-6 13.3-13.3 13.3S.7 87.3.7 80s6-13.3 13.3-13.3h13.3V80zm6.7 0c0-7.3 6-13.3 13.3-13.3s13.3 6 13.3 13.3v33.3c0 7.3-6 13.3-13.3 13.3s-13.3-6-13.3-13.3V80z" fill="#E01E5A"/>
      <path d="M47.3 27.3c-7.3 0-13.3-6-13.3-13.3S40 .7 47.3.7s13.3 6 13.3 13.3v13.3H47.3zm0 6.7c7.3 0 13.3 6 13.3 13.3s-6 13.3-13.3 13.3H14c-7.3 0-13.3-6-13.3-13.3S6.7 34 14 34h33.3z" fill="#36C5F0"/>
      <path d="M99.7 47.3c0-7.3 6-13.3 13.3-13.3s13.3 6 13.3 13.3-6 13.3-13.3 13.3H99.7V47.3zm-6.7 0c0 7.3-6 13.3-13.3 13.3s-13.3-6-13.3-13.3V14c0-7.3 6-13.3 13.3-13.3s13.3 6 13.3 13.3v33.3z" fill="#2EB67D"/>
      <path d="M79.7 99.7c7.3 0 13.3 6 13.3 13.3s-6 13.3-13.3 13.3-13.3-6-13.3-13.3V99.7h13.3zm0-6.7c-7.3 0-13.3-6-13.3-13.3s6-13.3 13.3-13.3h33.3c7.3 0 13.3 6 13.3 13.3s-6 13.3-13.3 13.3H79.7z" fill="#ECB22E"/>
    </svg>
  );
}

export function AppLogo({ appId, className = "h-5 w-5" }: { appId: string; className?: string }) {
  const normalized = appId.toLowerCase();
  if (normalized.includes("github")) return <GithubLogo className={className} />;
  if (normalized.includes("postgres")) return <PostgresLogo className={className} />;
  if (normalized.includes("sqlite")) return <SqliteLogo className={className} />;
  if (normalized.includes("gdrive") || normalized.includes("google")) return <GdriveLogo className={className} />;
  if (normalized.includes("slack")) return <SlackLogo className={className} />;
  if (normalized.includes("filesystem") || normalized.includes("folder")) return <Folder className={cn("text-indigo-500", className)} />;
  if (normalized.includes("fetch") || normalized.includes("scraper") || normalized.includes("web")) return <Globe className={cn("text-emerald-500", className)} />;
  if (normalized.includes("puppeteer")) return <Monitor className={cn("text-rose-500", className)} />;
  if (normalized.includes("sequential") || normalized.includes("thinking") || normalized.includes("brain")) return <Brain className={cn("text-violet-500", className)} />;
  if (normalized.includes("memory")) return <Cpu className={cn("text-teal-500", className)} />;
  return <Server className={cn("text-muted-foreground", className)} />;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type MarketplaceApp = {
  id: string;
  title: string;
  description: string;
  category: string;
  capabilities: string[];
  mcp_config_template: {
    name: string;
    type: "stdio" | "sse" | "streamable_http";
    url?: string;
    command?: string;
    args?: string[];
  };
  author: string;
  installs_count: number;
  rating: number;
  featured: boolean;
  sales_generated?: string;
  active_users?: number;
  rearvy_invocations?: number;
  love_count?: number;
};

type ConnectedServer = {
  id: string;
  name: string;
  type: string;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  is_active?: boolean;
};

type ApiConfig = {
  envKey: string;
  keyLabel: string;
  placeholder: string;
  helperText: string;
  isSecret?: boolean;
  required?: boolean;
};

const APP_API_CONFIG: Record<string, ApiConfig> = {
  app_github: {
    envKey: "GITHUB_PERSONAL_ACCESS_TOKEN",
    keyLabel: "GitHub Personal Access Token (PAT)",
    placeholder: "ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
    helperText: "Required for AI to search repos, inspect code, create issues, and manage PRs. Requires repo scope.",
    isSecret: true,
    required: true,
  },
  app_slack: {
    envKey: "SLACK_BOT_TOKEN",
    keyLabel: "Slack Bot Token (xoxb)",
    placeholder: "xoxb-xxxxxxxxxxxx-xxxxxxxxxxxx-xxxxxxxxxxxxxxxx",
    helperText: "Bot user token with channels:read and chat:write scopes for workspace automation.",
    isSecret: true,
    required: true,
  },
  app_postgres: {
    envKey: "POSTGRES_CONNECTION_STRING",
    keyLabel: "PostgreSQL Connection String",
    placeholder: "postgresql://username:password@localhost:5432/dbname",
    helperText: "Database connection URL for schema inspection and read-only AI analytics queries.",
    isSecret: true,
    required: true,
  },
  app_sqlite: {
    envKey: "SQLITE_DB_PATH",
    keyLabel: "SQLite Database Path",
    placeholder: "C:\\Users\\name\\data\\app.db",
    helperText: "Absolute local path to your SQLite database file.",
    isSecret: false,
    required: true,
  },
  app_gdrive: {
    envKey: "GDRIVE_API_KEY",
    keyLabel: "Google Drive API Key / Credentials",
    placeholder: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    helperText: "Google Cloud API Key or service token to access Drive docs and sheets.",
    isSecret: true,
    required: true,
  },
  app_filesystem: {
    envKey: "ALLOWED_DIRECTORY",
    keyLabel: "Allowed Workspace Directory Path",
    placeholder: "C:\\Users\\name\\projects",
    helperText: "Local path boundary where the AI is granted secure read and write access.",
    isSecret: false,
    required: false,
  },
  app_fetch: {
    envKey: "USER_AGENT_TOKEN",
    keyLabel: "Custom Headers / Bearer Token (Optional)",
    placeholder: "Bearer secret_token_here",
    helperText: "Optional authorization header or bearer token for protected site scraping.",
    isSecret: true,
    required: false,
  },
  app_puppeteer: {
    envKey: "PUPPETEER_EXECUTABLE_PATH",
    keyLabel: "Custom Chromium Executable Path (Optional)",
    placeholder: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    helperText: "Optional path to a custom Chrome or Chromium binary for browser execution.",
    isSecret: false,
    required: false,
  },
  app_sequential_thinking: {
    envKey: "THINKING_MAX_STEPS",
    keyLabel: "Maximum Reasoning Step Limit (Optional)",
    placeholder: "10",
    helperText: "Maximum sequential thinking steps before returning structured plans.",
    isSecret: false,
    required: false,
  },
  app_memory: {
    envKey: "MEMORY_FILE_PATH",
    keyLabel: "Graph Memory Storage Path (Optional)",
    placeholder: "C:\\Users\\name\\.rearvy\\memory.json",
    helperText: "Path to store persistent knowledge graph entries for your AI session.",
    isSecret: false,
    required: false,
  },
};

type ViewTab = "all" | "connected" | "not_connected" | "featured" | "trending" | "new";

// ─── Per-app enrichment (static, keyed by app id) ─────────────────────────────

type AppDetail = {
  whatItDoes: string;
  useCases: string[];
  prerequisites: string[];
  docsUrl?: string;
};

const APP_DETAILS: Record<string, AppDetail> = {
  app_filesystem: {
    whatItDoes:
      "Gives the AI secure, sandboxed read and write access to designated directories on your machine. The AI can browse folder structures, read file contents, write new files, and update existing ones — all within a configurable path boundary.",
    useCases: [
      "Let the AI read your project files and suggest code improvements",
      "Auto-generate reports and save them to a local output folder",
      "Scan a directory for documents and summarize their contents",
      "Write AI-generated content directly into your workspace",
      "Organize and rename files based on natural language instructions",
    ],
    prerequisites: [
      "Node.js 18+ installed locally",
      "Rearvy desktop app (stdio servers run locally only)",
      "A designated safe directory to grant access to",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/filesystem",
  },
  app_postgres: {
    whatItDoes:
      "Connects the AI to a live PostgreSQL database, enabling it to inspect schemas, run read-only analytical queries, and explain data relationships — without ever allowing destructive operations.",
    useCases: [
      "Ask the AI to explain your database schema in plain English",
      "Run complex SQL analytics using natural language questions",
      "Generate business insights from raw sales or user data",
      "Auto-document table relationships and column meanings",
      "Debug slow queries by letting the AI analyze execution plans",
    ],
    prerequisites: [
      "A running PostgreSQL instance (local or remote)",
      "A connection string (e.g. postgresql://user:pass@host/db)",
      "Node.js 18+ installed locally",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/postgres",
  },
  app_sqlite: {
    whatItDoes:
      "Lets the AI query and manage local SQLite database files directly. Ideal for lightweight analytics, embedded app databases, and rapid data exploration without a server.",
    useCases: [
      "Explore an existing SQLite database with natural language",
      "Generate pivot tables and aggregations from local data",
      "Migrate data between tables using AI-written SQL",
      "Inspect mobile app databases exported from iOS or Android",
      "Run data quality checks and surface anomalies automatically",
    ],
    prerequisites: [
      "A local .db or .sqlite file",
      "Node.js 18+ installed locally",
      "Rearvy desktop app (stdio servers run locally only)",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sqlite",
  },
  app_fetch: {
    whatItDoes:
      "Enables the AI to fetch any public web page, convert HTML to clean Markdown, and extract structured data from unstructured web content — acting as a powerful web research assistant.",
    useCases: [
      "Research competitors by scraping their public pricing pages",
      "Extract news articles and summarize them in seconds",
      "Monitor a webpage for changes and alert on new content",
      "Pull product data from e-commerce listings",
      "Convert web documentation into structured knowledge for the AI",
    ],
    prerequisites: [
      "An internet connection",
      "No authentication required for public pages",
      "For private pages, session cookies may be needed",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/fetch",
  },
  app_github: {
    whatItDoes:
      "Integrates the AI deeply into your GitHub workflow — searching repos, reading code, creating issues, reviewing pull requests, and automating git operations through natural language.",
    useCases: [
      "Ask the AI to review open pull requests and flag issues",
      "Create GitHub issues directly from a chat conversation",
      "Search across all your repos for a specific pattern or bug",
      "Generate release notes by analyzing recent commits",
      "Auto-assign labels and milestones based on issue content",
    ],
    prerequisites: [
      "A GitHub Personal Access Token (PAT) with repo scope",
      "Set GITHUB_PERSONAL_ACCESS_TOKEN environment variable",
      "Node.js 18+ installed locally",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/github",
  },
  app_gdrive: {
    whatItDoes:
      "Connects the AI to your Google Drive, enabling it to search files, read documents and spreadsheets, and extract business information from your cloud storage.",
    useCases: [
      "Search all your Drive files with a natural language query",
      "Summarize a long Google Doc in seconds",
      "Extract data from Google Sheets for analysis",
      "Find and surface related documents during a conversation",
      "Generate reports combining data from multiple Drive files",
    ],
    prerequisites: [
      "A Google Cloud project with Drive API enabled",
      "OAuth 2.0 credentials (client_id + client_secret)",
      "First-time authorization flow via browser",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/gdrive",
  },
  app_slack: {
    whatItDoes:
      "Bridges the AI with your Slack workspace — enabling it to send messages, read channel history, and surface team communications as business context.",
    useCases: [
      "Post AI-generated summaries to a Slack channel",
      "Search past conversations for decisions or action items",
      "Send automated status updates from workflows",
      "Create a digest of unread messages across channels",
      "Notify team members when the AI completes a task",
    ],
    prerequisites: [
      "A Slack workspace you administer",
      "A Slack Bot Token (xoxb-...) with channels:read, chat:write scopes",
      "Install the bot to at least one channel",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/slack",
  },
  app_puppeteer: {
    whatItDoes:
      "Gives the AI full control of a headless Chromium browser — navigating pages, filling forms, clicking elements, taking screenshots, and extracting data from JavaScript-rendered sites.",
    useCases: [
      "Automate repetitive web form submissions",
      "Take full-page screenshots of any URL for visual reports",
      "Extract data from SPAs and JavaScript-heavy websites",
      "Automate login flows and multi-step web workflows",
      "Run end-to-end UI tests described in plain English",
    ],
    prerequisites: [
      "Node.js 18+ installed locally",
      "Rearvy desktop app (requires local browser control)",
      "Chromium will be downloaded automatically on first run",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/puppeteer",
  },
  app_sequential_thinking: {
    whatItDoes:
      "Adds a structured multi-step reasoning layer to the AI — forcing it to break complex problems into sequential, verifiable steps before acting, reducing hallucinations on hard tasks.",
    useCases: [
      "Tackle complex multi-step business analysis with structured reasoning",
      "Let the AI plan and self-verify long automation pipelines",
      "Generate step-by-step strategic plans for a given goal",
      "Debug complex system issues with a structured root-cause analysis",
      "Break ambiguous requests into clear, actionable sub-tasks",
    ],
    prerequisites: [
      "Node.js 18+ installed locally",
      "Works alongside any other MCP server for enhanced reasoning",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking",
  },
  app_memory: {
    whatItDoes:
      "Maintains a persistent knowledge graph of entities, facts, and relationships across all your chat sessions — giving the AI a true long-term memory about your business.",
    useCases: [
      "Remember customer details, preferences, and interaction history",
      "Build a growing graph of business facts and relationships",
      "Recall past decisions and the reasoning behind them",
      "Track evolving project contexts across multiple sessions",
      "Connect related pieces of knowledge to surface insights",
    ],
    prerequisites: [
      "Node.js 18+ installed locally",
      "A local directory to persist the memory graph",
      "Rearvy desktop app recommended for persistent storage",
    ],
    docsUrl: "https://github.com/modelcontextprotocol/servers/tree/main/src/memory",
  },
};

// ─── View Tabs ────────────────────────────────────────────────────────────────

const VIEW_TABS: { id: ViewTab; label: string; icon: React.ElementType }[] = [
  { id: "all", label: "All MCP Servers", icon: LayoutGrid },
  { id: "connected", label: "Connected", icon: Plug },
  { id: "not_connected", label: "Not Connected", icon: ServerOff },
  { id: "featured", label: "Featured", icon: Sparkles },
  { id: "trending", label: "Trending", icon: TrendingUp },
  { id: "new", label: "Newly Launched", icon: Zap },
];

const CATEGORIES = [
  "All", "CRM", "Marketing", "Sales", "Finance", "HR",
  "Support", "Analytics", "Productivity", "Development", "Design", "AI",
];

// ─── MCP Detail Sheet ─────────────────────────────────────────────────────────

function McpDetailSheet({
  app,
  open,
  onOpenChange,
  isConnected,
  onInstall,
  installingId,
  connectedServers,
  onRefreshConnected,
}: {
  app: MarketplaceApp | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isConnected: boolean;
  onInstall: (app: MarketplaceApp) => Promise<void>;
  installingId: string | null;
  connectedServers: ConnectedServer[];
  onRefreshConnected: () => Promise<void>;
}) {
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [clearingKey, setClearingKey] = useState(false);
  const [isEditingKey, setIsEditingKey] = useState(false);

  useEffect(() => {
    setIsEditingKey(false);
    setApiKeyInput("");
  }, [app?.id]);

  const detail = app ? (APP_DETAILS[app.id] ?? null) : null;

  const connectedServer = app
    ? connectedServers.find((s) => {
        const appName = app.mcp_config_template.name.toLowerCase();
        const appTitle = app.title.toLowerCase();
        const sName = s.name.toLowerCase();
        return sName.includes(appName) || sName.includes(appTitle) || appTitle.includes(sName);
      })
    : undefined;

  const apiConfig = app
    ? (APP_API_CONFIG[app.id] ?? {
        envKey: "API_KEY",
        keyLabel: "API Token / Key",
        placeholder: "Paste API token...",
        helperText: "Credentials required for AI integration execution.",
        isSecret: true,
        required: false,
      })
    : {
        envKey: "API_KEY",
        keyLabel: "API Token / Key",
        placeholder: "Paste API token...",
        helperText: "Credentials required for AI integration execution.",
        isSecret: true,
        required: false,
      };

  const existingKey = connectedServer?.env?.[apiConfig.envKey] || "";

  const handleSaveApiKey = async () => {
    if (!app || !apiKeyInput.trim()) return;
    setSavingKey(true);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication required to save credentials");
        return;
      }
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service: app.id,
          apiKey: apiKeyInput.trim(),
          envKey: apiConfig.envKey,
        }),
      });
      if (res.ok) {
        toast.success(`API Key saved and connected for ${app.title}!`);
        setIsEditingKey(false);
        setApiKeyInput("");
        await onRefreshConnected();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save API Key");
      }
    } catch {
      toast.error("Failed to update API credentials");
    } finally {
      setSavingKey(false);
    }
  };

  const handleClearKey = async () => {
    if (!app) return;
    setClearingKey(true);
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          service: app.id,
          action: "clear",
          envKey: apiConfig.envKey,
        }),
      });
      if (res.ok) {
        toast.success(`Credentials cleared for ${app.title}`);
        setIsEditingKey(false);
        setApiKeyInput("");
        await onRefreshConnected();
      } else {
        toast.error("Failed to clear credentials");
      }
    } catch {
      toast.error("Failed to clear credentials");
    } finally {
      setClearingKey(false);
    }
  };

  if (!app) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl flex flex-col p-0 gap-0"
      >
        {/* Gradient header */}
        <div className="relative overflow-hidden border-b bg-card px-6 pt-8 pb-6">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(99,102,241,0.08),transparent_50%),linear-gradient(225deg,rgba(16,185,129,0.06),transparent_60%)]"
          />
          <SheetHeader className="relative p-0 gap-3">
            {/* Badges row */}
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className="text-[10px] uppercase tracking-wider font-semibold"
              >
                {app.category}
              </Badge>
              {app.featured && (
                <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30">
                  <Sparkles className="mr-1 h-3 w-3" /> Featured
                </Badge>
              )}
              {isConnected && (
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                  <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                </Badge>
              )}
              {existingKey && (
                <Badge className="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30">
                  <Key className="mr-1 h-3 w-3" /> API Key Active
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 pt-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/80 bg-muted/40 p-2 shadow-xs">
                <AppLogo appId={app.id} className="h-6 w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-xl font-bold leading-tight">
                  {app.title}
                </SheetTitle>
                <p className="text-xs text-muted-foreground/70 font-medium mt-0.5">
                  By {app.author}
                </p>
              </div>
            </div>
            <SheetDescription className="text-sm leading-relaxed text-muted-foreground pt-1">
              {app.description}
            </SheetDescription>
          </SheetHeader>
        </div>

        {/* Scrollable body */}
        <ScrollArea className="flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* API Session & Configuration Block */}
            <section className="rounded-xl border border-border/80 bg-card p-4 space-y-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border/40 pb-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                    <Key className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-foreground">
                      API Session & Configuration
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {apiConfig.required ? "API Token required for AI execution" : "Configure environment & API session tokens"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {/* Existing Key Active Card */}
                {existingKey && !isEditingKey ? (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                          Active API Session
                        </span>
                      </div>
                      <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 dark:text-emerald-400">
                        Synced with AI Brain
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 rounded bg-muted/60 px-2.5 py-1.5 font-mono text-xs text-foreground">
                      <Lock className="h-3 w-3 text-emerald-500 shrink-0" />
                      <span className="flex-1 truncate">
                        {`${apiConfig.envKey}: ${existingKey.length > 8 ? `${existingKey.slice(0, 4)}••••••••${existingKey.slice(-4)}` : "••••••••"}`}
                      </span>
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        Env key: <code className="font-mono text-foreground font-semibold">{apiConfig.envKey}</code>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground"
                          onClick={() => {
                            setApiKeyInput("");
                            setIsEditingKey(true);
                          }}
                        >
                          Update Key
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-[11px] text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400"
                          onClick={handleClearKey}
                          disabled={clearingKey}
                        >
                          {clearingKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3 mr-1" />}
                          Clear
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Key Input Form */
                  <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); void handleSaveApiKey(); }} className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-foreground flex items-center justify-between">
                        <span>{apiConfig.keyLabel}</span>
                        <code className="text-[10px] text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 px-1.5 py-0.5 rounded font-mono">
                          {apiConfig.envKey}
                        </code>
                      </label>
                      <p className="text-[11px] text-muted-foreground leading-normal">
                        {apiConfig.helperText}
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="relative flex-1">
                        <Input
                          id={`mcp-key-input-${app.id}`}
                          name={`mcp_token_${apiConfig.envKey}_no_autofill`}
                          type={apiConfig.isSecret && !showKey ? "password" : "text"}
                          placeholder={apiConfig.placeholder}
                          value={apiKeyInput}
                          onChange={(e) => setApiKeyInput(e.target.value)}
                          className="font-mono text-xs pr-8 bg-muted/30"
                          autoComplete="new-password"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck={false}
                          data-1password-ignore="true"
                          data-bwignore="true"
                          data-lpignore="true"
                        />
                        {apiConfig.isSecret && (
                          <button
                            type="button"
                            onClick={() => setShowKey(!showKey)}
                            className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                          >
                            {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                          </button>
                        )}
                      </div>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={savingKey || !apiKeyInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white shrink-0 text-xs h-9 px-3"
                      >
                        {savingKey ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <>
                            <Key className="mr-1.5 h-3.5 w-3.5" />
                            Save & Connect Session
                          </>
                        )}
                      </Button>
                    </div>

                    {isEditingKey && (
                      <div className="flex justify-end">
                        <Button
                          type="button"
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setIsEditingKey(false)}
                        >
                          Cancel editing
                        </Button>
                      </div>
                    )}
                  </form>
                )}
              </div>
            </section>

            {/* What it does */}
            {detail?.whatItDoes && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What It Does
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-foreground/85">
                  {detail.whatItDoes}
                </p>
              </section>
            )}

            {/* Use cases */}
            {detail?.useCases && detail.useCases.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    What You Can Do
                  </h3>
                </div>
                <ul className="space-y-2">
                  {detail.useCases.map((uc, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-indigo-500" />
                      <span className="text-foreground/85">{uc}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Capabilities tags */}
            <section>
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Capabilities
                </h3>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {app.capabilities.map((cap) => (
                  <Badge
                    key={cap}
                    variant="secondary"
                    className="text-xs font-normal px-2.5 py-1"
                  >
                    {cap}
                  </Badge>
                ))}
              </div>
            </section>

            {/* Prerequisites */}
            {detail?.prerequisites && detail.prerequisites.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Prerequisites
                  </h3>
                </div>
                <ul className="space-y-2">
                  {detail.prerequisites.map((req, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm">
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span className="text-foreground/85">{req}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Server type info */}
            <section className="rounded-[8px] border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
              <p className="font-semibold text-foreground/80 mb-1">
                Transport: {app.mcp_config_template.type === "stdio" ? "Stdio (Local Process)" : "SSE (Server-Sent Events)"}
              </p>
              {app.mcp_config_template.type === "stdio" ? (
                <p>
                  This server runs as a local subprocess on your machine. It requires the Rearvy desktop app or a local development environment with Node.js installed.
                </p>
              ) : (
                <p>
                  This server connects over HTTP/SSE to a remote endpoint. It works in both the desktop app and the hosted web version of Rearvy.
                </p>
              )}
            </section>

            {/* Docs link */}
            {detail?.docsUrl && (
              <a
                href={detail.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-500 hover:text-indigo-600 underline-offset-4 hover:underline dark:text-indigo-400"
              >
                View official documentation
                <ArrowRight className="h-3 w-3" />
              </a>
            )}
          </div>
        </ScrollArea>

        {/* Footer CTA */}
        <div className="border-t bg-card/80 px-6 py-4">
          {isConnected ? (
            <div className="flex items-center justify-center gap-2 rounded-[8px] border border-emerald-200 bg-emerald-50 py-2.5 text-sm font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              Connected to your workspace
            </div>
          ) : (
            <Button
              className="w-full"
              onClick={() => onInstall(app)}
              disabled={installingId === app.id}
            >
              {installingId === app.id ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Connect Integration
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

export function MarketplacePanel() {
  const [apps, setApps] = useState<MarketplaceApp[]>([]);
  const [connectedServers, setConnectedServers] = useState<ConnectedServer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [activeView, setActiveView] = useState<ViewTab>("all");
  const [loading, setLoading] = useState(true);
  const [installingId, setInstallingId] = useState<string | null>(null);
  const [selectedApp, setSelectedApp] = useState<MarketplaceApp | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const fetchConnectedServers = useCallback(async () => {
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/mcp/servers", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const servers: ConnectedServer[] = Array.isArray(data.servers)
          ? data.servers.map((s: { id: string; name: string; type: string; command?: string; args?: string[]; url?: string; env?: Record<string, string>; is_active?: boolean }) => ({
              id: s.id,
              name: s.name,
              type: s.type,
              command: s.command,
              args: s.args,
              url: s.url,
              env: s.env || {},
              is_active: s.is_active,
            }))
          : [];
        setConnectedServers(servers);
      }
    } catch {
      // Non-critical — silently ignore
    }
  }, []);

  const fetchMarketplace = useCallback(async () => {
    try {
      const res = await fetch("/api/mcp/marketplace");
      const data = await res.json();
      setApps(data.apps || []);
    } catch {
      toast.error("Failed to load Marketplace integrations");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchMarketplace();
    void fetchConnectedServers();
  }, [fetchMarketplace, fetchConnectedServers]);

  const connectedNames = new Set(connectedServers.map((s) => s.name.toLowerCase()));
  const isAppConnected = (app: MarketplaceApp) =>
    connectedNames.has(app.mcp_config_template.name.toLowerCase());

  const handleInstallApp = async (app: MarketplaceApp) => {
    setInstallingId(app.id);
    try {
      const token = await getIdToken();
      if (!token) {
        toast.error("Authentication required to install integration");
        return;
      }
      const res = await fetch("/api/mcp/marketplace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "install", appId: app.id }),
      });
      if (res.ok) {
        toast.success(`Installed "${app.title}" integration!`);
        await fetchConnectedServers();
      } else {
        const err = await res.json();
        toast.error(err.error || "Installation failed");
      }
    } catch {
      toast.error("Failed to install integration");
    } finally {
      setInstallingId(null);
    }
  };

  const handleCardClick = (app: MarketplaceApp) => {
    setSelectedApp(app);
    setSheetOpen(true);
  };

  // View tab filter
  const viewFilteredApps = (() => {
    switch (activeView) {
      case "connected":
        return apps.filter(isAppConnected);
      case "not_connected":
        return apps.filter((app) => !isAppConnected(app));
      case "featured":
        return apps.filter((app) => app.featured);
      case "trending":
        return [...apps].sort((a, b) => b.installs_count - a.installs_count).slice(0, 6);
      case "new":
        return [...apps].slice(-6).reverse();
      default:
        return apps;
    }
  })();

  // Search + category filter
  const filteredApps = viewFilteredApps.filter((app) => {
    const matchesCategory = selectedCategory === "All" || app.category === selectedCategory;
    const matchesSearch =
      app.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.capabilities.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  const handleClearAllCredentials = async () => {
    if (!confirm("Are you sure you want to clear all saved MCP credentials and disconnect all integrations?")) return;
    try {
      const token = await getIdToken();
      if (!token) return;
      const res = await fetch("/api/mcp/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: "clear_all" }),
      });
      if (res.ok) {
        toast.success("All saved credentials and connected servers cleared successfully.");
        await fetchConnectedServers();
      } else {
        toast.error("Failed to clear credentials");
      }
    } catch {
      toast.error("Failed to clear credentials");
    }
  };

  const connectedCount = apps.filter(isAppConnected).length;

  return (
    <div className="space-y-4">
      {/* View Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-[8px] border bg-card/90 p-1 shadow-sm backdrop-blur">
        {VIEW_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={cn(
                "flex h-9 shrink-0 items-center gap-2 rounded-[7px] px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
              {tab.id === "connected" && connectedCount > 0 ? (
                <span
                  className={cn(
                    "ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none",
                    isActive
                      ? "bg-white/20 text-white dark:bg-slate-950/20 dark:text-slate-950"
                      : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  )}
                >
                  {connectedCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {/* Search & Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            id="mcp-search-input"
            name="mcp_search_no_autofill"
            type="search"
            placeholder="Search apps or capabilities..."
            className="pl-9"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-1password-ignore="true"
            data-bwignore="true"
            data-lpignore="true"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 flex-1">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              size="sm"
              className="text-xs h-7 px-2.5"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Button>
          ))}
          {connectedCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearAllCredentials}
              className="text-xs text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-rose-400 h-7 px-2 sm:ml-auto"
            >
              <Trash2 className="mr-1 h-3 w-3" />
              Clear All Credentials
            </Button>
          )}
        </div>
      </div>

      {/* App Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredApps.length === 0 ? (
        <Card className="border-dashed py-12 text-center">
          <CardContent>
            <Layers className="mx-auto h-8 w-8 text-muted-foreground/50 mb-2" />
            <p className="text-muted-foreground">
              {activeView === "connected"
                ? "No connected MCP servers yet. Install one from the All tab."
                : "No integrations found matching your filters."}
            </p>
            {activeView === "connected" ? (
              <Button
                variant="link"
                className="mt-2 h-auto p-0 text-sm"
                onClick={() => setActiveView("all")}
              >
                Browse all MCP servers
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredApps.map((app) => {
            const connected = isAppConnected(app);
            return (
              <Card
                key={app.id}
                onClick={() => handleCardClick(app)}
                className={cn(
                  "flex flex-col justify-between cursor-pointer hover:shadow-md transition-all hover:-translate-y-0.5",
                  connected && "border-l-2 border-l-emerald-500"
                )}
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-muted/30 shadow-xs mt-0.5">
                        <AppLogo appId={app.id} className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider font-semibold"
                        >
                          {app.category}
                        </Badge>
                        <CardTitle className="text-base font-bold truncate">
                          {app.title}
                        </CardTitle>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {app.featured ? (
                        <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]">
                          <Sparkles className="mr-1 h-3 w-3" /> Featured
                        </Badge>
                      ) : null}
                      {connected ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]">
                          <CheckCircle2 className="mr-1 h-3 w-3" /> Connected
                        </Badge>
                      ) : null}
                    </div>
                  </div>
                  <CardDescription className="text-xs leading-relaxed line-clamp-2 mt-2">
                    {app.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="p-4 pt-0">
                  <div className="flex flex-wrap gap-1">
                    {app.capabilities.map((cap) => (
                      <Badge key={cap} variant="secondary" className="text-[10px] font-normal py-0 px-2">
                        {cap}
                      </Badge>
                    ))}
                  </div>
                </CardContent>

                <CardFooter className="p-4 pt-0">
                  {connected ? (
                    <div className="flex w-full items-center justify-center gap-1.5 rounded-[8px] border border-emerald-200 bg-emerald-50 py-2 text-xs font-medium text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/30 dark:text-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Connected to your workspace
                    </div>
                  ) : (
                    <Button
                      className="w-full text-xs h-8"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleInstallApp(app);
                      }}
                      disabled={installingId === app.id}
                    >
                      {installingId === app.id ? (
                        <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-3.5 w-3.5" />
                      )}
                      Connect Integration
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Sheet */}
      <McpDetailSheet
        app={selectedApp}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        isConnected={selectedApp ? isAppConnected(selectedApp) : false}
        onInstall={handleInstallApp}
        installingId={installingId}
        connectedServers={connectedServers}
        onRefreshConnected={fetchConnectedServers}
      />
    </div>
  );
}
