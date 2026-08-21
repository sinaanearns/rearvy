export type IntegrationProviderKey =
  | "shopify"
  | "razorpay"
  | "youtube"
  | "instagram"
  | "facebook"
  | "github"
  | "google_analytics"
  | "gmail"
  | "excel"
  | "linkedin";

function hasEnv(...names: string[]): boolean {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

export function isShopifyIntegrationConfigured(): boolean {
  return hasEnv("SHOPIFY_API_KEY", "SHOPIFY_API_SECRET");
}

export function isRazorpayIntegrationConfigured(): boolean {
  return hasEnv("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
}

export function isGoogleIntegrationConfigured(): boolean {
  return hasEnv("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET");
}

export function isMetaIntegrationConfigured(): boolean {
  return hasEnv("META_APP_ID", "META_APP_SECRET");
}

export function isGitHubIntegrationConfigured(): boolean {
  return hasEnv("GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET");
}

export function isExcelIntegrationConfigured(): boolean {
  return hasEnv("MICROSOFT_CLIENT_ID", "MICROSOFT_CLIENT_SECRET");
}

export function isLinkedInIntegrationConfigured(): boolean {
  return hasEnv("LINKEDIN_CLIENT_ID", "LINKEDIN_CLIENT_SECRET");
}

export function getConfiguredIntegrationProviders(): Record<
  IntegrationProviderKey,
  boolean
> {
  const googleConfigured = isGoogleIntegrationConfigured();
  const metaConfigured = isMetaIntegrationConfigured();

  return {
    shopify: isShopifyIntegrationConfigured(),
    razorpay: isRazorpayIntegrationConfigured(),
    youtube: googleConfigured,
    instagram: metaConfigured,
    facebook: metaConfigured,
    github: isGitHubIntegrationConfigured(),
    google_analytics: googleConfigured,
    gmail: googleConfigured,
    excel: isExcelIntegrationConfigured(),
    linkedin: isLinkedInIntegrationConfigured(),
  };
}
