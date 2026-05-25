export const APP_NAME = "Rearvy";
export const APP_DESCRIPTION =
  "AI-powered business assistant with multi-provider model routing";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  CALLBACK: "/callback",
  CHAT: "/chat",
  PROJECTS: "/projects",
  INSIGHTS: "/insights",
  WHISPERNET: "/whispernet",
  INTEGRATIONS: "/work/integrations",
  SETTINGS: "/settings",
} as const;

export const CHAT_CONFIG = {
  MAX_TOOL_STEPS: 12,
  MODEL: "auto",
  TITLE_MODEL: "auto",
  SUMMARY_MODEL: "auto",
  MAX_MESSAGES_BEFORE_SUMMARY: 10,
} as const;
