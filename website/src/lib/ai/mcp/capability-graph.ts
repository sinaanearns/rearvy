import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type McpServerConfig,
  type McpToolCatalogEntry,
} from "@/lib/firebase/schema";
import { normalizeMcpServerDocument } from "./server-config";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("CapabilityGraph");

export type BusinessCapability =
  | "email"
  | "crm"
  | "calendar"
  | "image_generation"
  | "video_editing"
  | "social_media"
  | "finance"
  | "inventory"
  | "database"
  | "documents"
  | "storage"
  | "analytics"
  | "browser_automation"
  | "search"
  | "design"
  | "development"
  | "payments";

export interface CapabilityDefinition {
  type: BusinessCapability;
  label: string;
  description: string;
  keywords: string[];
  sensitivePermissions: string[];
}

export const BUSINESS_CAPABILITIES: Record<BusinessCapability, CapabilityDefinition> = {
  email: {
    type: "email",
    label: "Email Communication",
    description: "Read, compose, draft, and send email campaigns and client communications.",
    keywords: ["email", "gmail", "outlook", "mail", "draft", "inbox", "smtp", "send_email"],
    sensitivePermissions: ["send_emails"],
  },
  crm: {
    type: "crm",
    label: "Customer Relationship Management",
    description: "Manage contacts, leads, customer profiles, pipeline deals, and accounts.",
    keywords: ["crm", "salesforce", "hubspot", "zoho", "leads", "contacts", "deals", "customers"],
    sensitivePermissions: ["read_customers", "write_customers"],
  },
  calendar: {
    type: "calendar",
    label: "Calendar & Scheduling",
    description: "Schedule events, check availability, create meetings, and manage tasks.",
    keywords: ["calendar", "schedule", "meeting", "events", "availability", "gcal", "outlook_calendar"],
    sensitivePermissions: ["manage_calendar"],
  },
  image_generation: {
    type: "image_generation",
    label: "AI Image Generation",
    description: "Generate promotional images, logos, banner visuals, and marketing artwork.",
    keywords: ["image", "visual", "banner", "logo", "photo", "artwork", "dalle", "midjourney", "picture"],
    sensitivePermissions: [],
  },
  video_editing: {
    type: "video_editing",
    label: "Video Production & Editing",
    description: "Create video clips, edit timelines, generate promotional videos, and assemble video ads.",
    keywords: ["video", "davinci", "clip", "timeline", "trailer", "promo", "ffmpeg", "render"],
    sensitivePermissions: [],
  },
  social_media: {
    type: "social_media",
    label: "Social Media Publishing",
    description: "Create, schedule, post, and track social media content across platforms.",
    keywords: ["social", "instagram", "twitter", "linkedin", "facebook", "pinterest", "post", "tweet"],
    sensitivePermissions: ["post_social"],
  },
  finance: {
    type: "finance",
    label: "Financial Management",
    description: "Handle invoices, transaction records, accounting, currency calculation, and expense tracking.",
    keywords: ["finance", "stripe", "razorpay", "invoice", "charge", "revenue", "expense", "budget", "accounting"],
    sensitivePermissions: ["create_invoice", "process_payment"],
  },
  inventory: {
    type: "inventory",
    label: "Inventory & Supply Chain",
    description: "Track product stock levels, sync store inventory, check product availability, and manage SKUs.",
    keywords: ["inventory", "stock", "sku", "product", "warehouse", "shopify", "supply", "fulfillment"],
    sensitivePermissions: ["update_inventory"],
  },
  database: {
    type: "database",
    label: "Database & SQL Operations",
    description: "Execute SQL queries, fetch records, mutate databases, and inspect database schemas.",
    keywords: ["database", "db", "sql", "postgres", "mysql", "sqlite", "query", "tables"],
    sensitivePermissions: ["write_database"],
  },
  documents: {
    type: "documents",
    label: "Document Generation & Management",
    description: "Draft reports, create PDFs, generate presentation outlines, and edit Notion/Drive docs.",
    keywords: ["document", "doc", "pdf", "report", "notion", "google_drive", "drive", "file", "word"],
    sensitivePermissions: ["delete_files"],
  },
  storage: {
    type: "storage",
    label: "Cloud & File Storage",
    description: "Upload, download, store, and share business assets and media files.",
    keywords: ["storage", "s3", "gcs", "drive", "upload", "download", "cloud_file"],
    sensitivePermissions: ["delete_files"],
  },
  analytics: {
    type: "analytics",
    label: "Business Analytics & Tracking",
    description: "Track website traffic, campaign conversions, KPI reports, and user metrics.",
    keywords: ["analytics", "google_analytics", "ga4", "metrics", "traffic", "conversion", "kpi", "dashboard"],
    sensitivePermissions: [],
  },
  browser_automation: {
    type: "browser_automation",
    label: "Web Browser Automation",
    description: "Perform web scraping, form submission, app navigation, and web page screenshots.",
    keywords: ["browser", "playwright", "puppeteer", "scrape", "navigate", "web_task", "click", "form"],
    sensitivePermissions: ["browser_control"],
  },
  search: {
    type: "search",
    label: "Web & Trend Search",
    description: "Search web sources, research market trends, extract facts, and discover competitor insights.",
    keywords: ["search", "google", "bing", "perplexity", "research", "web_search", "trends"],
    sensitivePermissions: [],
  },
  design: {
    type: "design",
    label: "Graphic Design & Assets",
    description: "Design posters, banners, brand templates, presentation slides, and graphics in Canva/Figma.",
    keywords: ["design", "canva", "figma", "poster", "banner", "template", "slides", "graphics"],
    sensitivePermissions: [],
  },
  development: {
    type: "development",
    label: "Code & Software Development",
    description: "Inspect repositories, manage pull requests, create issues, run code, and build software.",
    keywords: ["code", "github", "git", "pull_request", "issue", "repository", "terminal", "python"],
    sensitivePermissions: ["execute_code"],
  },
  payments: {
    type: "payments",
    label: "Payments & Transfers",
    description: "Process payments, execute crypto/EVM transfers, manage subscriptions, and process refunds.",
    keywords: ["payment", "stripe", "razorpay", "metamask", "transfer", "eth", "crypto", "charge", "refund"],
    sensitivePermissions: ["process_payment"],
  },
};

export function extractCapabilitiesFromMcpTool(toolName: string, description: string = ""): BusinessCapability[] {
  const text = `${toolName.replace(/([a-z0-9])([A-Z])/g, "$1 $2")} ${description}`
    .toLowerCase()
    .replace(/[_-]+/g, " ");
  const matchedCapabilities: Set<BusinessCapability> = new Set();

  for (const [capType, def] of Object.entries(BUSINESS_CAPABILITIES)) {
    if (
      def.keywords.some((keyword) => {
        const normalizedKeyword = keyword.toLowerCase().replace(/[_-]+/g, " ");
        const escaped = normalizedKeyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return new RegExp(`(^|[^a-z0-9])${escaped.replace(/\s+/g, "\\s+")}($|[^a-z0-9])`).test(
          text
        );
      })
    ) {
      matchedCapabilities.add(capType as BusinessCapability);
    }
  }

  return Array.from(matchedCapabilities);
}

const DESTRUCTIVE_TOOL_PATTERN =
  /(^|[._-])(delete|remove|destroy|drop|purge|revoke|transfer|charge|refund|purchase|buy|pay|execute)([._-]|$)/i;
const PUBLISH_TOOL_PATTERN =
  /(^|[._-])(publish|post|send|submit|upload|broadcast|release|deploy)([._-]|$)/i;
const WRITE_TOOL_PATTERN =
  /(^|[._-])(create|update|edit|write|add|set|schedule|move|copy|rename|approve|invite)([._-]|$)/i;
const READ_TOOL_PATTERN =
  /(^|[._-])(get|list|search|fetch|read|inspect|analyze|query|find|download|status|preview|lookup|discover)([._-]|$)/i;

export type McpToolRisk = McpToolCatalogEntry["risk"];

function normalizeToolNameForRisk(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .toLowerCase();
}

/**
 * MCP does not standardize action risk metadata. Unknown operations therefore
 * default to write, which keeps them behind Rearvy's approval gate.
 */
export function inferMcpToolRisk(toolName: string, description: string = ""): McpToolRisk {
  const normalizedName = normalizeToolNameForRisk(toolName.trim());
  const normalizedDescription = description.trim().toLowerCase();

  if (DESTRUCTIVE_TOOL_PATTERN.test(normalizedName)) return "destructive";
  if (PUBLISH_TOOL_PATTERN.test(normalizedName)) return "publish";
  if (WRITE_TOOL_PATTERN.test(normalizedName)) return "write";
  if (READ_TOOL_PATTERN.test(normalizedName)) return "read";

  if (/\b(delete|remove|transfer funds|charge card|issue refund|make payment)\b/i.test(normalizedDescription)) {
    return "destructive";
  }
  if (/\b(publish|post publicly|send message|send email|upload|deploy)\b/i.test(normalizedDescription)) {
    return "publish";
  }
  if (/\b(create|update|edit|modify|write|schedule|change)\b/i.test(normalizedDescription)) {
    return "write";
  }
  if (/\b(read|retrieve|list|search|inspect|analyze|query|preview|look up|fetch)\b/i.test(normalizedDescription)) {
    return "read";
  }

  return "write";
}

const MATCH_TOKEN_PATTERN = /[a-z0-9]+/g;
const IGNORED_MATCH_TOKENS = new Set([
  "a",
  "an",
  "and",
  "for",
  "from",
  "in",
  "of",
  "on",
  "the",
  "to",
  "with",
]);

function matchTokens(value: string) {
  return new Set(
    (value.toLowerCase().match(MATCH_TOKEN_PATTERN) ?? []).filter(
      (token) => token.length > 1 && !IGNORED_MATCH_TOKENS.has(token)
    )
  );
}

export function selectMcpToolForTask(
  server: Pick<McpServerConfig, "tool_catalog">,
  capability: BusinessCapability,
  taskText: string
): McpToolCatalogEntry | null {
  const candidates = (server.tool_catalog ?? []).filter((tool) =>
    tool.capabilities.includes(capability)
  );
  if (candidates.length === 0) return null;

  const taskTokens = matchTokens(taskText);
  const ranked = candidates.map((tool) => {
    const toolTokens = matchTokens(`${tool.name} ${tool.description}`);
    let score = 100;
    for (const token of taskTokens) {
      if (toolTokens.has(token)) score += 5;
    }
    const normalizedToolName = tool.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normalizedToolName.includes(capability.replaceAll("_", ""))) score += 10;
    return { tool, score };
  });

  ranked.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    return left.tool.name.localeCompare(right.tool.name);
  });

  return ranked[0]?.tool ?? null;
}

export function scoreMcpProvider(
  server: McpServerConfig,
  capability: BusinessCapability,
  grantedPermissions: string[] = []
): { score: number; reasons: string[] } {
  let score = 50;
  const reasons: string[] = [];

  if (!server.is_active) {
    return { score: 0, reasons: ["Server is marked inactive"] };
  }

  const capabilities = new Set(server.capabilities || []);
  const hasCatalogMatch = (server.tool_catalog ?? []).some((tool) =>
    tool.capabilities.includes(capability)
  );
  if (!capabilities.has(capability) && !hasCatalogMatch) {
    return { score: 0, reasons: [`Does not declare the ${capability} capability`] };
  }
  score += 30;
  reasons.push(`Explicitly provides ${capability} capability`);

  if (server.health_status === "healthy") {
    score += 20;
    reasons.push("Health status is healthy");
  } else if (server.health_status === "degraded") {
    score -= 15;
    reasons.push("Health status is degraded");
  } else if (server.health_status === "unreachable") {
    return { score: 0, reasons: ["Server unreachable"] };
  }

  if (server.latency_ms && server.latency_ms > 0) {
    if (server.latency_ms < 200) {
      score += 10;
      reasons.push("Low latency (<200ms)");
    } else if (server.latency_ms > 1000) {
      score -= 10;
      reasons.push("High latency (>1000ms)");
    }
  }

  // Permission checks
  const requiredPermissions = BUSINESS_CAPABILITIES[capability]?.sensitivePermissions || [];
  for (const perm of requiredPermissions) {
    if (grantedPermissions.includes(perm)) {
      score += 10;
      reasons.push(`Granted required permission: ${perm}`);
    }
  }

  return { score: Math.max(1, score), reasons };
}

export interface ProviderResolutionResult {
  capability: BusinessCapability;
  selectedProvider: McpServerConfig | null;
  fallbacks: McpServerConfig[];
  score: number;
  reasons: string[];
}

export async function resolveMcpProvidersForCapabilities(
  userId: string,
  requiredCapabilities: BusinessCapability[],
  grantedPermissions: string[] = [],
  allowedServerIds: string[] | null = null
): Promise<Record<BusinessCapability, ProviderResolutionResult>> {
  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", userId)
      .where("is_active", "==", true)
      .get();

    const allowedServerIdSet = Array.isArray(allowedServerIds)
      ? new Set(allowedServerIds)
      : null;
    const servers = snapshot.docs
      .map((doc) => normalizeMcpServerDocument(doc.id, doc.data()))
      .filter((server) => (allowedServerIdSet ? allowedServerIdSet.has(server.id) : true));

    const resolution: Partial<Record<BusinessCapability, ProviderResolutionResult>> = {};

    for (const capability of requiredCapabilities) {
      const candidates = servers
        .map((server) => {
          const { score, reasons } = scoreMcpProvider(server, capability, grantedPermissions);
          return { server, score, reasons };
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score);

      if (candidates.length > 0) {
        const topMatch = candidates[0];
        resolution[capability] = {
          capability,
          selectedProvider: topMatch.server,
          fallbacks: candidates.slice(1).map((c) => c.server),
          score: topMatch.score,
          reasons: topMatch.reasons,
        };
      } else {
        resolution[capability] = {
          capability,
          selectedProvider: null,
          fallbacks: [],
          score: 0,
          reasons: ["No active MCP server matches this capability"],
        };
      }
    }

    return resolution as Record<BusinessCapability, ProviderResolutionResult>;
  } catch (error) {
    log.error("Failed to resolve MCP providers:", error);
    const fallbackRes: Partial<Record<BusinessCapability, ProviderResolutionResult>> = {};
    for (const cap of requiredCapabilities) {
      fallbackRes[cap] = {
        capability: cap,
        selectedProvider: null,
        fallbacks: [],
        score: 0,
        reasons: ["Error fetching MCP servers"],
      };
    }
    return fallbackRes as Record<BusinessCapability, ProviderResolutionResult>;
  }
}
