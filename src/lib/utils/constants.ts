export const APP_NAME = "Rearvy";
export const APP_DESCRIPTION =
  "AI-powered business assistant powered by NVIDIA-hosted models";

export const ROUTES = {
  HOME: "/",
  LOGIN: "/login",
  SIGNUP: "/signup",
  CALLBACK: "/callback",
  CHAT: "/chat",
  PROJECTS: "/projects",
  INSIGHTS: "/insights",
  WHISPERNET: "/whispernet",
  INTEGRATIONS: "/integrations",
  SETTINGS: "/settings",
} as const;

export const CHAT_CONFIG = {
  MAX_TOOL_STEPS: 16,
  MODEL: "gamma",
  TITLE_MODEL: "gamma",
  SUMMARY_MODEL: "gamma",
  MAX_MESSAGES_BEFORE_SUMMARY: 10,
} as const;
