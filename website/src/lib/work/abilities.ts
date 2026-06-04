export type BuiltInAbilityTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
};

export const BUILT_IN_ABILITY_TEMPLATES: BuiltInAbilityTemplate[] = [
  {
    id: "web-research",
    name: "Web Research",
    description: "Search, fetch, compare, and summarize public web information.",
    category: "Research",
    capabilities: ["searchWeb", "fetchWebPage"],
  },
  {
    id: "business-data",
    name: "Business Data",
    description: "Analyze revenue, orders, products, reviews, traffic, and synced social data.",
    category: "Analytics",
    capabilities: ["revenue", "orders", "products", "reviews", "analytics"],
  },
  {
    id: "browser-operator",
    name: "Browser Operator",
    description: "Run local browser-use sessions with explicit approval for sensitive actions.",
    category: "Local execution",
    capabilities: ["runBrowserTask", "controlBrowserSession"],
  },
  {
    id: "terminal-files",
    name: "Terminal and Files",
    description: "Read files, inspect directories, and run local terminal commands when permitted.",
    category: "Local execution",
    capabilities: ["listDirectory", "readFile", "runTerminalCommand"],
  },
  {
    id: "commerce-ops",
    name: "Commerce Ops",
    description: "Use existing Shopify, Gmail, Instagram, Facebook, YouTube, Excel, and GitHub data for operations work.",
    category: "Operations",
    capabilities: ["integrations", "sync", "gmailDrafts"],
  },
  {
    id: "documents",
    name: "Documents",
    description: "Draft and package downloadable PDF, Word, markdown, text, and HTML documents.",
    category: "Creation",
    capabilities: ["generateDocument"],
  },
  {
    id: "agent-teamwork",
    name: "Agent Teamwork",
    description: "Delegate subtasks to specialists and aggregate results for complex work.",
    category: "Collaboration",
    capabilities: ["delegateToSpecialistAgent", "spawnAgentTeam"],
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
  documents: ["generateDocument"],
  "agent-teamwork": [
    "delegateToSpecialistAgent",
    "spawnAgentTeam",
  ],
};
