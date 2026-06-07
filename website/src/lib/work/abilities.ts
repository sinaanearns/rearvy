export type BuiltInAbilityTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  examples?: string[];
  availability?: "ready" | "desktop" | "configured";
};

export const BUILT_IN_ABILITY_TEMPLATES: BuiltInAbilityTemplate[] = [
  {
    id: "web-research",
    name: "Research Retrieval",
    description:
      "Search, fetch, compare, map, and summarize public web information with source context and specialized search modes.",
    category: "Research",
    availability: "ready",
    capabilities: ["searchWeb", "searchType", "fetchWebPage", "generateMap"],
    examples: [
      "Compare competitor offers and cite source pages.",
      "Extract facts from a public page before drafting a report.",
    ],
  },
  {
    id: "business-data",
    name: "Business Data",
    description: "Analyze revenue, orders, products, reviews, traffic, and synced social data.",
    category: "Analytics",
    availability: "configured",
    capabilities: ["revenue", "orders", "products", "reviews", "analytics"],
    examples: [
      "Explain the biggest traffic or revenue movement.",
      "Prepare a client-ready performance snapshot.",
    ],
  },
  {
    id: "browser-operator",
    name: "Browser Operator",
    description:
      "Run cloud or local browser sessions for navigation, page inspection, public web tasks, screenshots, and web app workflows.",
    category: "Execution",
    availability: "configured",
    capabilities: [
      "requestBrowserConnection",
      "runBrowserTask",
      "controlBrowserSession",
      "stopBrowserSession",
    ],
    examples: [
      "Open a website, gather evidence, and keep the session inspectable.",
      "Use cloud browser live view for public tasks; pause before passwords, CAPTCHA, payment, or one-time codes.",
    ],
  },
  {
    id: "terminal-files",
    name: "File And System Ops",
    description:
      "Inspect files, list directories, queue shell commands, and prepare safe desktop file workflows.",
    category: "Local execution",
    availability: "desktop",
    capabilities: ["listDirectory", "readFile", "runTerminalCommand", "planWorkflow"],
    examples: [
      "Read a local file or inspect a project folder.",
      "Plan write, append, replace, move, copy, reveal, or shell-command steps behind approval.",
    ],
  },
  {
    id: "commerce-ops",
    name: "Commerce Ops",
    description: "Use existing Shopify, Gmail, Instagram, Facebook, YouTube, Excel, and GitHub data for operations work.",
    category: "Operations",
    availability: "configured",
    capabilities: ["integrations", "sync", "gmailDrafts"],
    examples: [
      "Summarize connected inbox, social, analytics, and store signals.",
      "Prepare review-before-send Gmail drafts.",
    ],
  },
  {
    id: "automation-scheduler",
    name: "Automation Scheduler",
    description:
      "Coordinate recurring work through Work automations, listeners, source tasks, approval queues, and run history.",
    category: "Operations",
    availability: "ready",
    capabilities: ["automations", "listeners", "runs", "approvals"],
    examples: [
      "Create a recurring operating rhythm for an agent.",
      "Watch sources or channels and queue approval-gated follow-up.",
    ],
  },
  {
    id: "media-studio",
    name: "Media Studio",
    description:
      "Generate images, edit supplied images, create short video assets, and analyze public media links from available evidence.",
    category: "Creation",
    availability: "configured",
    capabilities: ["generateMedia", "analyzeMedia"],
    examples: [
      "Generate campaign visuals or social thumbnails.",
      "Edit an uploaded product image with a precise instruction.",
      "Summarize a YouTube, video, audio, or podcast link without inventing missing transcript content.",
    ],
  },
  {
    id: "documents",
    name: "Documents And Reports",
    description:
      "Draft and package downloadable PDF, Word, markdown, text, and HTML documents.",
    category: "Creation",
    availability: "ready",
    capabilities: ["generateDocument"],
    examples: [
      "Create a proposal, memo, report, one-pager, or contract.",
      "Package the same brief into PDF and DOCX files.",
    ],
  },
  {
    id: "presentation-planning",
    name: "Presentation Planning",
    description:
      "Create slide-ready outlines, speaker notes, and deck documents; use browser workflows for hosted slide tools when explicitly requested.",
    category: "Creation",
    availability: "ready",
    capabilities: ["generateDocument", "runBrowserTask"],
    examples: [
      "Turn research into a slide outline with speaker notes.",
      "Prepare content for Google Slides or another hosted deck editor.",
    ],
  },
  {
    id: "agent-teamwork",
    name: "Agent Teamwork",
    description: "Delegate subtasks to specialists and aggregate results for complex work.",
    category: "Collaboration",
    availability: "ready",
    capabilities: ["delegateToSpecialistAgent", "spawnAgentTeam"],
    examples: [
      "Split a large build, review, or research job into specialist work.",
      "Combine specialist outputs into one user-facing answer.",
    ],
  },
  {
    id: "mcp-extensions",
    name: "MCP Extensions",
    description:
      "Use connected MCP servers as optional tool extensions after verifying the relevant provider is enabled.",
    category: "Extensions",
    availability: "configured",
    capabilities: ["mcpTools"],
    examples: [
      "Route niche external tasks through connected MCP tools.",
      "Avoid claiming provider support until the matching tool is present.",
    ],
  },
];

export const BUILT_IN_ABILITY_IDS = BUILT_IN_ABILITY_TEMPLATES.map(
  (ability) => ability.id
);

export const BUILT_IN_ABILITY_NAMES = BUILT_IN_ABILITY_TEMPLATES.map(
  (ability) => ability.name
);

const DESKTOP_WORKFLOW_TOOL_NAMES = [
  "executeWorkflow",
  "planWorkflow",
  "listWorkflowTemplates",
  "getWorkflowStatus",
];

export const CORE_WORK_TOOL_NAMES = [
  "getCurrentDate",
  "askUser",
  "requestBrowserConnection",
];

export const BUILT_IN_ABILITY_TOOL_NAMES: Record<string, string[]> = {
  "web-research": [
    "searchWeb",
    "fetchWebPage",
    "generateMap",
  ],
  "business-data": [
    "getCollectionsOverview",
    "getCollectionsBreakdown",
    "getRevenue",
    "getRevenueBreakdown",
    "getOrders",
    "getOrderDetails",
    "getTopProducts",
    "getProductDetails",
    "getInventoryStatus",
    "comparePerformance",
    "getCustomerMetrics",
    "getRecentInsights",
    "getYouTubeChannelStats",
    "getTopYouTubeVideos",
    "getYouTubeVideoPerformance",
    "getYouTubeComments",
    "getInstagramAccountStats",
    "getTopInstagramPosts",
    "getInstagramPostPerformance",
    "getInstagramComments",
    "getProductReviews",
    "getReviewSummary",
    "getGoogleAnalyticsOverview",
    "getGoogleAnalyticsTopPages",
    "getGoogleAnalyticsTrafficSources",
    "getWebsiteOverview",
    "getTopPages",
    "getTrafficSources",
  ],
  "browser-operator": [
    "requestBrowserConnection",
    "runBrowserTask",
    "controlBrowserSession",
    "stopBrowserSession",
    ...DESKTOP_WORKFLOW_TOOL_NAMES,
  ],
  "terminal-files": [
    "runTerminalCommand",
    "listDirectory",
    "readFile",
    ...DESKTOP_WORKFLOW_TOOL_NAMES,
  ],
  "commerce-ops": [
    "getIntegrationStatus",
    "getGmailInboxSummary",
    "getRecentGmailMessages",
    "searchGmailMessages",
    "getGmailSettings",
    "prepareGmailMessage",
    "runWhispernetAnalysis",
    "getTradingOpinion",
    "getBestTradeOpportunity",
    "getVerifiedTraderSignals",
  ],
  "automation-scheduler": [
    "getCurrentDate",
    "askUser",
    "delegateToSpecialistAgent",
    "spawnAgentTeam",
  ],
  "media-studio": ["generateMedia", "analyzeMedia"],
  documents: ["generateDocument"],
  "presentation-planning": [
    "generateDocument",
    "requestBrowserConnection",
    "runBrowserTask",
    "controlBrowserSession",
    "stopBrowserSession",
  ],
  "agent-teamwork": [
    "delegateToSpecialistAgent",
    "spawnAgentTeam",
  ],
  "mcp-extensions": [],
};
