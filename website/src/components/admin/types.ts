import type { ChatAttachment } from "@/lib/chat/attachments";

export type AdminActivity = {
  id: string;
  source: string;
  title: string;
  detail: string;
  status: string;
  timestamp: string;
};

export type AdminBusiness = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
  status: string;
  stage: string;
  member_count: number;
  founder_id: string | null;
  created_at: string;
};

export type AdminUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  disabled: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  username?: string | null;
  fullName?: string | null;
  existingChatId?: string | null;
};

export type AdminStats = {
  totalUsers: number;
  activeChats: number;
  revenue: number;
  currency: string;
  latency: string;
  websiteEventCount: number;
  latestActivityAgeMinutes: number | null;
};

export type AdminStatsResponse = {
  adminEmail: string | null;
  adminUid: string | null;
  stats: AdminStats;
  recentActivities: AdminActivity[];
  recentBusinesses: AdminBusiness[];
  users: AdminUser[];
};

export type AdminJoinRequest = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_name: string | null;
  message: string | null;
  status: string;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
  decision_note: string | null;
};

export type AdminChatMessage = {
  id: string;
  chat_id: string;
  sender_id: string | null;
  content: string | null;
  created_at: unknown;
  attachments?: ChatAttachment[];
};

export type ViewingUserMessage = {
  id: string;
  role?: string | null;
  content?: string | null;
  created_at?: string | number | Date | null;
};

export type ViewingUserChat = {
  id: string;
  title?: string | null;
  created_at?: string | number | Date | null;
  messages?: ViewingUserMessage[];
};

export type ViewingUserIntegration = {
  id: string;
  provider: string;
  provider_account_name?: string | null;
  status?: string | null;
};

export type ViewingUserEvent = {
  id: string;
  event_name?: string | null;
  event_type?: string | null;
  path?: string | null;
  timestamp?: string | number | Date | null;
};

export type ViewingUserData = {
  chats: ViewingUserChat[];
  integrations: ViewingUserIntegration[];
  events: ViewingUserEvent[];
};
