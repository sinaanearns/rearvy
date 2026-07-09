import type { ToolContext } from "../types";
import { createServerLogger } from "@/lib/server-logger";
import {
  getCollectionsOverview,
  getCollectionsBreakdown,
} from "./collections";
import { getRevenue, getRevenueBreakdown } from "./revenue";
import { getOrders, getOrderDetails } from "./orders";
import {
  getTopProducts,
  getProductDetails,
  getInventoryStatus,
} from "./products";
import { comparePerformance } from "./compare";
import { getCustomerMetrics } from "./customers";
import { searchMemories, saveMemory } from "./memories";



import { getRecentInsights } from "./insights";
import { getIntegrationStatus, getCurrentDate } from "./utility";
import { searchWeb, fetchWebPage } from "./web";
import { generateMap } from "./generate-map";
import {
  getYouTubeChannelStats,
  getTopYouTubeVideos,
  getYouTubeVideoPerformance,
  getYouTubeComments,
} from "./youtube";
import {
  getInstagramAccountStats,
  getTopInstagramPosts,
  getInstagramPostPerformance,
  getInstagramComments,
} from "./instagram";
import { getProductReviews, getReviewSummary } from "./reviews";
import {
  getWebsiteOverview,
  getTopPages,
  getTrafficSources,
} from "./website";
import {
  getGoogleAnalyticsOverview,
  getGoogleAnalyticsTopPages,
  getGoogleAnalyticsTrafficSources,
} from "./google-analytics";
import {
  getGmailInboxSummary,
  getRecentGmailMessages,
  searchGmailMessages,
  getGmailSettings,
  prepareGmailMessage,
  getGmailThread,
  draftGmailReply,
} from "./gmail";

import { runWhispernetAnalysis } from "./whispernet";
import { getBestTradeOpportunityTool, getTradingOpinionTool } from "./trading-opinion";
import { getVerifiedTraderSignalsTool } from "./trader-signals";
import { askUserTool } from "./ask-user";
import { requestBrowserConnectionTool } from "./browser-connection";
import { getMcpTools } from "../mcp/hub";
import {
  runBrowserTask,
  controlBrowserSession,
  stopBrowserSessionTool,
} from "./browser";
import {
  runTerminalCommand,
  listDirectoryTool,
  readFileTool,
  writeFileTool,
  appendFileTool,
} from "./terminal";
import { generateMedia } from "./media";
import { analyzeMedia } from "./media-analysis";
import { generateDocument } from "./document";
import {
  listCloudFiles,
  uploadCloudFile,
  downloadCloudFile,
} from "./storage";
import {
  getCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  findFreeTime,
} from "./calendar";
import { executiveRun } from "./executive";
import { executionRun } from "./execution";
import { sendSlackMessage, listSlackChannels, readSlackChannel } from "./slack";
import {
  searchNotionTool,
  createNotionPageTool,
  updateNotionPageTool,
} from "./notion";

const log = createServerLogger("AITools");

// Note: desktop automation tools import desktop-only modules (robotjs, node-window-manager).
// We avoid importing them at top-level to prevent server/web bundlers from trying to resolve
// native modules during Next.js builds. Instead we dynamically import the module only
// when `includeFLERBAITools` is truthy at runtime.

type ToolRegistryOptions = {
  includeWebTools?: boolean;
  includeBrowserTools?: boolean;
  includeTerminalTools?: boolean;
  includeFLERBAITools?: boolean;
  includeMcpTools?: boolean;
  allowedToolNames?: string[] | null;
  allowedMcpServerIds?: string[] | null;
};

type DesktopAutomationToolsModule = {
  getFLERBAITools: (
    ctx: ToolContext
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
};

function isDesktopAutomationToolsModule(
  value: unknown
): value is DesktopAutomationToolsModule {
  if (!value || typeof value !== "object") {
    return false;
  }

  const mod = value as { getFLERBAITools?: unknown };
  return typeof mod.getFLERBAITools === "function";
}

export async function createToolRegistry(
  ctx: ToolContext,
  options: ToolRegistryOptions = {}
) {
  const {
    includeWebTools = true,
    includeBrowserTools = true,
    includeTerminalTools = true,
    includeFLERBAITools = ctx.isDesktopApp,
    includeMcpTools = true,
    allowedToolNames = null,
    allowedMcpServerIds = null,
  } = options;

  // Prepare FLERB tools only if requested. Use dynamic import with computed path
  // so bundlers don't try to statically resolve desktop-only modules during web builds.
  let flerbaTools: Record<string, unknown> = {};
  if (includeFLERBAITools) {
    try {
      const modPath = "./" + "desktop-automation";
      const mod: unknown = await import(modPath);
      if (isDesktopAutomationToolsModule(mod)) {
        flerbaTools = await mod.getFLERBAITools(ctx);
      }
    } catch (err) {
      log.warn("FLERB AI tools not available in this environment:", err);
      flerbaTools = {};
    }
  }

  const baseTools = {
    getCollectionsOverview: getCollectionsOverview(ctx),
    getCollectionsBreakdown: getCollectionsBreakdown(ctx),
    getRevenue: getRevenue(ctx),
    getRevenueBreakdown: getRevenueBreakdown(ctx),
    getOrders: getOrders(ctx),
    getOrderDetails: getOrderDetails(ctx),
    getTopProducts: getTopProducts(ctx),
    getProductDetails: getProductDetails(ctx),
    getInventoryStatus: getInventoryStatus(ctx),
    comparePerformance: comparePerformance(ctx),
    getCustomerMetrics: getCustomerMetrics(ctx),
    searchMemories: searchMemories(ctx),
    saveMemory: saveMemory(ctx),

    getRecentInsights: getRecentInsights(ctx),
    getIntegrationStatus: getIntegrationStatus(ctx),
    getCurrentDate: getCurrentDate(),
    askUser: askUserTool(ctx),
    requestBrowserConnection: requestBrowserConnectionTool(ctx),
    generateMap: generateMap(ctx),
    ...(includeWebTools
      ? {
          searchWeb: searchWeb(ctx),
          fetchWebPage: fetchWebPage(ctx),
        }
      : {}),
    ...(includeBrowserTools
      ? {
          runBrowserTask: runBrowserTask(ctx),
          controlBrowserSession: controlBrowserSession(ctx),
          stopBrowserSession: stopBrowserSessionTool(ctx),
        }
      : {}),
    getYouTubeChannelStats: getYouTubeChannelStats(ctx),
    getTopYouTubeVideos: getTopYouTubeVideos(ctx),
    getYouTubeVideoPerformance: getYouTubeVideoPerformance(ctx),
    getYouTubeComments: getYouTubeComments(ctx),
    getInstagramAccountStats: getInstagramAccountStats(ctx),
    getTopInstagramPosts: getTopInstagramPosts(ctx),
    getInstagramPostPerformance: getInstagramPostPerformance(ctx),
    getInstagramComments: getInstagramComments(ctx),
    getProductReviews: getProductReviews(ctx),
    getReviewSummary: getReviewSummary(ctx),
    getGoogleAnalyticsOverview: getGoogleAnalyticsOverview(ctx),
    getGoogleAnalyticsTopPages: getGoogleAnalyticsTopPages(ctx),
    getGoogleAnalyticsTrafficSources: getGoogleAnalyticsTrafficSources(ctx),
    getWebsiteOverview: getWebsiteOverview(ctx),
    getTopPages: getTopPages(ctx),
    getTrafficSources: getTrafficSources(ctx),
    getGmailInboxSummary: getGmailInboxSummary(ctx),
    getRecentGmailMessages: getRecentGmailMessages(ctx),
    searchGmailMessages: searchGmailMessages(ctx),
    getGmailSettings: getGmailSettings(ctx),
    prepareGmailMessage: prepareGmailMessage(ctx),
    getGmailThread: getGmailThread(ctx),
    draftGmailReply: draftGmailReply(ctx),
    runWhispernetAnalysis: runWhispernetAnalysis(ctx),
    getTradingOpinion: getTradingOpinionTool(ctx),
    getBestTradeOpportunity: getBestTradeOpportunityTool(ctx),
    getVerifiedTraderSignals: getVerifiedTraderSignalsTool(ctx),
    ...(includeTerminalTools
      ? {
          runTerminalCommand: runTerminalCommand(ctx),
          listDirectory: listDirectoryTool(ctx),
          readFile: readFileTool(ctx),
          writeFile: writeFileTool(ctx),
          appendFile: appendFileTool(ctx),
        }
      : {}),
    ...flerbaTools,
    generateMedia: generateMedia(ctx),
    analyzeMedia: analyzeMedia(ctx),
    generateDocument: generateDocument(ctx),
    listCloudFiles: listCloudFiles(ctx),
    uploadCloudFile: uploadCloudFile(ctx),
    downloadCloudFile: downloadCloudFile(ctx),
    getCalendarEvents: getCalendarEvents(ctx),
    createCalendarEvent: createCalendarEvent(ctx),
    updateCalendarEvent: updateCalendarEvent(ctx),
    findFreeTime: findFreeTime(ctx),
    executiveRun: executiveRun(ctx),
    executionRun: executionRun(ctx),
    sendSlackMessage: sendSlackMessage(ctx),
    listSlackChannels: listSlackChannels(ctx),
    readSlackChannel: readSlackChannel(ctx),
    searchNotion: searchNotionTool(ctx),
    createNotionPage: createNotionPageTool(ctx),
    updateNotionPage: updateNotionPageTool(ctx),
  };

  const filteredBaseTools =
    allowedToolNames === null
      ? baseTools
      : Object.fromEntries(
          Object.entries(baseTools).filter(([name]) => allowedToolNames.includes(name))
        );

  return {
    ...filteredBaseTools,
    ...(includeMcpTools
      ? await getMcpTools(ctx.userId, {
          isDesktopApp: ctx.isDesktopApp,
          allowedServerIds: allowedMcpServerIds,
        })
      : {}),
  };
}
