/**
 * Firestore Collections Schema
 * 
 * This defines the Firestore collection structure that mirrors the PostgreSQL schema.
 */

export const COLLECTIONS = {
  // User profiles
  PROFILES: "profiles",
  
  // Projects
  PROJECTS: "projects",
  PROJECT_TEMPLATES: "project_templates",
  
  // Chats and Messages
  CHATS: "chats",
  MESSAGES: "messages",
  
  // Integrations
  INTEGRATIONS: "integrations",
  INTEGRATION_SYNC_JOBS: "integration_sync_jobs",
  
  // Business Metrics
  BUSINESS_METRICS: "business_metrics",
  
  // E-commerce data
  PRODUCTS: "products",
  ORDERS: "orders",
  PRODUCT_REVIEWS: "product_reviews",
  
  // YouTube data
  YOUTUBE_CHANNELS: "youtube_channels",
  YOUTUBE_VIDEOS: "youtube_videos",
  YOUTUBE_COMMENTS: "youtube_comments",
  
  // Instagram data
  INSTAGRAM_ACCOUNTS: "instagram_accounts",
  INSTAGRAM_POSTS: "instagram_posts",
  INSTAGRAM_COMMENTS: "instagram_comments",
  
  // Website tracking
  WEBSITES: "websites",
  WEBSITE_SESSIONS: "website_sessions",
  WEBSITE_PAGEVIEWS: "website_pageviews",
  WEBSITE_EVENTS: "website_events",
  
  // AI Features
  MEMORIES: "memories",
  INSIGHTS: "insights",
} as const;

/**
 * Firestore Document Types (matching database.ts)
 */

export interface Profile {
  id: string; // same as user uid
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  business_name: string | null;
  business_type: "shopify" | "content_creator" | "agency" | "other" | null;
  onboarding_completed: boolean;
  timezone: string;
  currency: string;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Chat {
  id: string;
  user_id: string;
  project_id: string | null;
  title: string | null;
  parent_chat_id: string | null;
  fork_point_message_id: string | null;
  is_archived: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Message {
  id: string;
  chat_id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string | null;
  parts: unknown[] | null;
  tool_invocations: unknown[] | null;
  metadata: Record<string, unknown>;
  created_at: Date | string;
}

export interface Integration {
  id: string;
  user_id: string;
  provider: "shopify" | "youtube" | "instagram" | "stripe" | "google_analytics" | "website";
  provider_account_id: string | null;
  provider_account_name: string | null;
  access_token_enc: string;
  refresh_token_enc?: string;
  token_iv: string;
  scopes: string[];
  token_expires_at: Date | string | null;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: Date | string | null;
  sync_cursor: Record<string, unknown>;
  created_at: Date | string;
  updated_at: Date | string;
}
