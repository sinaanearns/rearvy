import type { SupabaseClient } from "@supabase/supabase-js";
import type { ToolContext } from "../types";
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
import {
  getTikTokAccountStats,
  getTopTikTokVideos,
  getTikTokVideoPerformance,
} from "./tiktok";
import { getProductReviews, getReviewSummary } from "./reviews";

export function createToolRegistry(ctx: ToolContext) {
  return {
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
    getCurrentDate: getCurrentDate(ctx),
    getYouTubeChannelStats: getYouTubeChannelStats(ctx),
    getTopYouTubeVideos: getTopYouTubeVideos(ctx),
    getYouTubeVideoPerformance: getYouTubeVideoPerformance(ctx),
    getYouTubeComments: getYouTubeComments(ctx),
    getInstagramAccountStats: getInstagramAccountStats(ctx),
    getTopInstagramPosts: getTopInstagramPosts(ctx),
    getInstagramPostPerformance: getInstagramPostPerformance(ctx),
    getInstagramComments: getInstagramComments(ctx),
    getTikTokAccountStats: getTikTokAccountStats(ctx),
    getTopTikTokVideos: getTopTikTokVideos(ctx),
    getTikTokVideoPerformance: getTikTokVideoPerformance(ctx),
    getProductReviews: getProductReviews(ctx),
    getReviewSummary: getReviewSummary(ctx),
  };
}
