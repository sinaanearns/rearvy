export const APP_NAME = "Rearvy";
export const APP_DESCRIPTION =
  "AI-powered business assistant powered by Kimi 2.5";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  CALLBACK: "/callback",
  CHAT: "/chat",
  PROJECTS: "/projects",
  INSIGHTS: "/insights",
  INTEGRATIONS: "/integrations",
  SETTINGS: "/settings",
} as const;

export const CHAT_CONFIG = {
  MAX_TOOL_STEPS: 5,
  MODEL: "kimi-2.5",
  TITLE_MODEL: "kimi-2.5",
  SUMMARY_MODEL: "kimi-2.5",
  MAX_MESSAGES_BEFORE_SUMMARY: 10,
} as const;
