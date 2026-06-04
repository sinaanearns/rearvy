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
  const has3dTool = Array.from(toolSet).some((name) =>
    /^mcp_.*(3d|blender|mesh|render)/i.test(name)
  );
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
    items.push("Research public web sources, compare options, and summarize findings with source context.");
  }

  if (
    toolSet.has("getGmailInboxSummary") ||
    toolSet.has("searchGmailMessages") ||
    toolSet.has("prepareGmailMessage")
  ) {
    items.push("Summarize connected Gmail activity and prepare draft emails for review when Gmail is connected.");
  }

  if (toolSet.has("runBrowserTask") || toolSet.has("controlBrowserSession")) {
    items.push("Run approval-gated browser tasks in the local desktop/dev runtime, including login or signup flows where sensitive fields stay in the browser, competitor research, screenshot evidence, and build-ready product briefs from what Maria finds.");
  }

  if (toolSet.has("planWorkflow") || toolSet.has("executeWorkflow")) {
    items.push(
      isFullAccessMode
        ? "Prepare approval-gated desktop workflows for screenshots, app/file/folder navigation, path reveal, file read/list/write steps, safe local product artifacts/prototype files, explicit shell commands, mouse movement/clicks/drags, typing, key presses, clipboard steps, and scrolling."
        : "Prepare scoped desktop workflows such as screenshots, app/file/folder navigation, path reveal, file read/list/write steps, safe local product artifacts/prototype files, explicit shell commands, or mouse/keyboard actions when the Desktop Workspace approval flow is enabled."
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

  if (toolSet.has("delegateToSpecialistAgent") || toolSet.has("spawnAgentTeam")) {
    items.push("Delegate complex work to specialist agents and summarize their output.");
  }

  if (toolSet.has("generateMedia")) {
    items.push("Generate images or short videos when media provider keys are configured.");
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
    has3dTool
      ? "For 3D asset generation, I will mention a provider only after using the matching enabled tool successfully."
      : "3D asset generation is not a core Rearvy capability in this chat; I will only mention a 3D provider after a matching tool is enabled and used successfully.",
  ].join("\n");
}
