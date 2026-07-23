type IntegrationLike = {
  provider?: string | null;
  status?: string | null;
};

type CapabilityResponseParams = {
  toolNames: Iterable<string>;
  isDesktopApp: boolean;
  isFullAccessMode?: boolean;
  connectedIntegrations?: IntegrationLike[];
};

const BUSINESS_TOOL_NAMES = [
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
  "getInstagramAccountStats",
  "getTopInstagramPosts",
  "getInstagramPostPerformance",
  "getProductReviews",
  "getReviewSummary",
  "getGoogleAnalyticsOverview",
  "getGoogleAnalyticsTopPages",
  "getGoogleAnalyticsTrafficSources",
  "getWebsiteOverview",
  "getTopPages",
  "getTrafficSources",
];

function hasAny(toolSet: Set<string>, names: string[]) {
  return names.some((name) => toolSet.has(name));
}

function hasActiveIntegrations(integrations: IntegrationLike[] = []) {
  return integrations.some((integration) => {
    if (!integration.provider) {
      return false;
    }

    const status = (integration.status || "").toLowerCase();
    return !["", "none", "inactive", "disconnected", "revoked", "error"].includes(status);
  });
}

export function isCapabilityQuestion(userText: string | null | undefined) {
  if (!userText) {
    return false;
  }

  const normalized = userText
    .toLowerCase()
    .replace(/[^\w\s/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized || normalized.length > 140) {
    return false;
  }

  return [
    /^\/?help$/,
    /^what can (you|u) do$/,
    /^what do (you|u) do$/,
    /^what can (you|u) help( me)? with$/,
    /^what are (your|rearvy s) (features|capabilities|skills)$/,
    /^what (features|capabilities|skills|tools) (do|can) (you|u) (have|use)$/,
    /^show( me)? (your )?(features|capabilities|skills|tools)$/,
  ].some((pattern) => pattern.test(normalized));
}

export function buildCapabilityResponse({
  toolNames,
  isDesktopApp,
  isFullAccessMode = false,
  connectedIntegrations = [],
}: CapabilityResponseParams) {
  const toolSet = new Set(Array.from(toolNames));

  const items = [
    "Answer business, strategy, operations, copy, planning, and troubleshooting questions using the context in this chat.",
  ];
  const hasLiveDataSources = hasActiveIntegrations(connectedIntegrations);

  if (hasAny(toolSet, BUSINESS_TOOL_NAMES)) {
    items.push(
      hasLiveDataSources
        ? "Analyze connected business data for revenue, orders, products, reviews, traffic, social performance, and website behavior."
        : "Help analyze business metrics once data sources are connected; when live data is missing, I will say that plainly."
    );
  }

  if (toolSet.has("searchWeb") && toolSet.has("fetchWebPage")) {
    items.push("Run research retrieval across public web sources, bias searches toward news, images, API docs, tools, datasets, or academic references, fetch pages, compare options, extract useful facts, and summarize findings with source context.");
  }

  if (toolSet.has("generateMap")) {
    items.push("Generate interactive maps for company locations, offices, markets, routes, facilities, trade flows, and geographic risk when coordinates or supported location evidence are available.");
  }

  if (
    toolSet.has("getGmailInboxSummary") ||
    toolSet.has("searchGmailMessages") ||
    toolSet.has("prepareGmailMessage")
  ) {
    items.push("Summarize connected Gmail activity and prepare draft emails for review when Gmail is connected.");
  }

  if (toolSet.has("runBrowserTask") || toolSet.has("controlBrowserSession")) {
    items.push("Run approval-gated browser operator tasks in the local desktop/dev runtime, including navigation, page inspection, form workflows, login or signup flows where sensitive fields stay in the browser, competitor research, screenshot evidence, and build-ready product briefs from what Maria finds.");
  }

  if (toolSet.has("planWorkflow") || toolSet.has("executeWorkflow")) {
    items.push(
      isFullAccessMode
        ? "Prepare desktop and system workflows for screenshots, screen inspection, app/file/folder navigation, path reveal, file read/list/write steps, safe local product artifacts/prototype files, explicit shell commands, mouse movement/clicks/drags, typing, key presses, clipboard steps, and scrolling. Single-step screenshots can run immediately; OS-control actions remain approval-gated."
        : "Prepare scoped desktop and system workflows such as screenshots, screen inspection, app/file/folder navigation, path reveal, file read/list/write steps, safe local product artifacts/prototype files, explicit shell commands, or mouse/keyboard actions when the Desktop Workspace approval flow is enabled. Single-step screenshots can run immediately when desktop tools are enabled."
    );
  } else if (isDesktopApp) {
    items.push("Use desktop mode context, but I will not claim OS control unless workflow tools are enabled for the current turn.");
  }

  if (hasAny(toolSet, ["listDirectory", "readFile", "runTerminalCommand"])) {
    items.push("Inspect local files and run terminal commands when that permission is enabled.");
  }

  if (toolSet.has("getTradingOpinion") || toolSet.has("getVerifiedTraderSignals")) {
    items.push("Summarize configured trading opinions or verified trader signals instead of making up market calls.");
  }

  if (toolSet.has("analyzeMedia")) {
    items.push("Analyze or summarize public media links from available metadata/page evidence, transcribe direct public audio/video file URLs when AssemblyAI is configured, and clearly flag when YouTube/page transcription requires the desktop Maria bridge or a supplied transcript.");
  }

  if (toolSet.has("generateDocument")) {
    items.push("Create downloadable PDF, Microsoft Word DOCX, markdown, text, and HTML documents from a brief, including slide-ready presentation outlines and speaker-note documents.");
  }

  if (Array.from(toolSet).some((name) => /^mcp_/i.test(name))) {
    items.push("Use connected MCP tools for specific external tasks, but only after verifying the relevant tool is available.");
  }

  return [
    "I can execute available tasks from chat, ask only when a safe next step needs your input, and refuse illegal, harmful, credential-theft, privacy-invasive, or unapproved destructive work.",
    "",
    "I can help with:",
    "",
    ...items.map((item) => `- ${item}`),
    "",
    "3D asset generation is not a core Rearvy capability in this chat; I will only mention a 3D provider after a matching tool is enabled and used successfully.",
  ].join("\n");
}
