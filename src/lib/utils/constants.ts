export const APP_NAME = "Rearvy";
export const APP_DESCRIPTION =
  "AI-powered business assistant for small businesses";

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
  MODEL: "gpt-4o",
  TITLE_MODEL: "gpt-4o-mini",
  SUMMARY_MODEL: "gpt-4o-mini",
  MAX_MESSAGES_BEFORE_SUMMARY: 10,
} as const;
