import type { ToolContext } from "../types";
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
} from "./gmail";

import { runWhispernetAnalysis } from "./whispernet";
import { getBestTradeOpportunityTool, getTradingOpinionTool } from "./trading-opinion";
import { getVerifiedTraderSignalsTool } from "./trader-signals";
import { delegateToSpecialistAgent, spawnAgentTeam } from "./agents";
import { getMcpTools } from "../mcp/hub";
import {
  runBrowserTask,
  controlBrowserSession,
  stopBrowserSessionTool,
} from "./browser";

type ToolRegistryOptions = {
  includeWebTools?: boolean;
  includeBrowserTools?: boolean;
};


export async function createToolRegistry(
  ctx: ToolContext,
  options: ToolRegistryOptions = {}
) {
  const { includeWebTools = true, includeBrowserTools = true } = options;

  return {
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
    runWhispernetAnalysis: runWhispernetAnalysis(ctx),
    getTradingOpinion: getTradingOpinionTool(ctx),
    getBestTradeOpportunity: getBestTradeOpportunityTool(ctx),
    getVerifiedTraderSignals: getVerifiedTraderSignalsTool(ctx),
    delegateToSpecialistAgent: delegateToSpecialistAgent(ctx),
    spawnAgentTeam: spawnAgentTeam(ctx),
    ...(await getMcpTools(ctx.userId, { isDesktopApp: ctx.isDesktopApp })),
  };
}
