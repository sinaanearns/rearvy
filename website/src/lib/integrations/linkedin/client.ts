import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_OAUTH_BASE = "https://www.linkedin.com/oauth/v2";
const LINKEDIN_DEFAULT_TOKEN_EXPIRES_IN_SECONDS = 5_184_000;

export interface LinkedInConfig {
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: Date;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
}

type LinkedInTokenResponse = {
  accessToken: string;
  expiresIn: number;
};

export interface LinkedInUserProfile {
  id: string;
  localizedFirstName: string;
  localizedLastName: string;
  displayName?: string;
  headline?: string;
  vanityName?: string;
  profilePicture?: {
    displayImage: string;
  };
}

export interface LinkedInOrganizationProfile {
  id: string;
  name: string;
  localizedName: string;
  logo?: string;
  website?: string;
  industry?: string;
  description?: string;
}

export interface LinkedInPost {
  id: string;
  author: string;
  lifecycleState: string;
  specificContent: {
    "com.linkedin.ugc.ShareContent": {
      shareCommentary?: {
        text: string;
      };
      shareMediaCategory: "NONE" | "IMAGE" | "VIDEO" | "ARTICLE" | "AUDIO";
      media?: Array<{
        status: string;
        originalUrl?: string;
        title?: { text: string };
        description?: { text: string };
      }>;
    };
  };
  visibility: {
    "com.linkedin.ugc.MemberNetworkVisibility": string;
  };
  created?: { time: number };
  lastModified?: { time: number };
}

export interface LinkedInComment {
  id: string;
  parentComment?: string;
  created: { time: number };
  lastModified: { time: number };
  message: { text: string };
  socialDetail?: {
    totalLikes: number;
    totalComments: number;
  };
  actor: {
    image?: string;
    name?: string;
    title?: string;
  };
}

async function linkedinFetch<T>(
  config: LinkedInConfig,
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const url = path.startsWith("http") ? path : `${LINKEDIN_API_BASE}${path}`;

  const res = await fetch(url, {
    ...init,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${config.accessToken}`,
      "LinkedIn-Version": "202401",
      ...(init.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeTokenExpiresIn(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : LINKEDIN_DEFAULT_TOKEN_EXPIRES_IN_SECONDS;
}

function parseLinkedInTokenResponse(
  value: unknown,
  fallbackError: string
): LinkedInTokenResponse {
  if (!isRecord(value)) {
    throw new Error(fallbackError);
  }

  const accessToken = optionalString(value.access_token);
  if (!accessToken) {
    throw new Error(
      optionalString(value.error_description) ||
        optionalString(value.error) ||
        fallbackError
    );
  }

  return {
    accessToken,
    expiresIn: normalizeTokenExpiresIn(value.expires_in),
  };
}

export async function exchangeLinkedInCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; expiresIn: number }> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing LinkedIn OAuth credentials");
  }

  const res = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token exchange failed (${res.status}): ${text}`);
  }

  const tokenData = parseLinkedInTokenResponse(
    await res.json().catch(() => null),
    "LinkedIn token exchange failed"
  );

  return {
    accessToken: tokenData.accessToken,
    expiresIn: tokenData.expiresIn,
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshedTokens> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing LinkedIn OAuth credentials");
  }

  const res = await fetch(`${LINKEDIN_OAUTH_BASE}/accessToken`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn token refresh failed (${res.status}): ${text}`);
  }

  const tokenData = parseLinkedInTokenResponse(
    await res.json().catch(() => null),
    "LinkedIn token refresh failed"
  );

  return {
    accessToken: tokenData.accessToken,
    expiresAt: new Date(Date.now() + tokenData.expiresIn * 1000),
  };
}

async function ensureFreshToken(config: LinkedInConfig): Promise<string> {
  if (!config.refreshToken) {
    return config.accessToken;
  }

  if (
    config.tokenExpiresAt &&
    config.tokenExpiresAt.getTime() - Date.now() < 5 * 60 * 1000
  ) {
    const refreshed = await refreshAccessToken(config.refreshToken);
    config.accessToken = refreshed.accessToken;
    config.tokenExpiresAt = refreshed.expiresAt;
  }
  return config.accessToken;
}

export async function getLinkedInUserProfile(
  config: LinkedInConfig
): Promise<LinkedInUserProfile> {
  const token = await ensureFreshToken(config);
  const profile = await linkedinFetch<LinkedInUserProfile>(config, "/me", {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  return profile;
}

export async function getLinkedInOrganizationProfile(
  config: LinkedInConfig,
  organizationUrn: string
): Promise<LinkedInOrganizationProfile> {
  const profile = await linkedinFetch<LinkedInOrganizationProfile>(
    config,
    `/organizations/${organizationUrn}`
  );
  return profile;
}

export async function listLinkedInPosts(
  config: LinkedInConfig,
  authorUrn: string,
  maxPosts = 50
): Promise<LinkedInPost[]> {
  const posts: LinkedInPost[] = [];
  const perPage = 50;

  for (let page = 0; page < maxPosts / perPage; page++) {
    const batch = await linkedinFetch<{ elements: LinkedInPost[] }>(
      config,
      `/ugcPosts?authors=List(${encodeURIComponent(authorUrn)})&count=${perPage}&start=${page * perPage}&q="authors"&sortBy="LAST_MODIFIED"`
    );

    posts.push(...(batch.elements || []));
    
    if (!batch.elements || batch.elements.length < perPage) {
      break;
    }
  }

  return posts.slice(0, maxPosts);
}

export async function getLinkedInPostComments(
  config: LinkedInConfig,
  postUrn: string,
  maxComments = 100
): Promise<LinkedInComment[]> {
  const comments: LinkedInComment[] = [];
  const perPage = 50;

  for (let page = 0; page < maxComments / perPage; page++) {
    const socialDetails = await linkedinFetch<{
      elements: Array<{
        commentBackendIdentifier: string;
        comments: { elements: LinkedInComment[] };
      }>;
    }>(
      config,
      `/socialDetails?ids=List(${encodeURIComponent(postUrn)})`
    );

    if (socialDetails.elements?.[0]?.comments?.elements) {
      comments.push(...socialDetails.elements[0].comments.elements);
    }

    if (comments.length >= maxComments || !socialDetails.elements?.[0]?.comments?.elements) {
      break;
    }
  }

  return comments.slice(0, maxComments);
}

export async function getLinkedInProfilePosts(
  config: LinkedInConfig,
  profileId: string,
  maxPosts = 50
): Promise<LinkedInPost[]> {
  const authorUrn = `urn:li:person:${profileId}`;
  return listLinkedInPosts(config, authorUrn, maxPosts);
}

export async function getLinkedInOrganizationPosts(
  config: LinkedInConfig,
  organizationId: string,
  maxPosts = 50
): Promise<LinkedInPost[]> {
  const authorUrn = `urn:li:organization:${organizationId}`;
  return listLinkedInPosts(config, authorUrn, maxPosts);
}

export async function persistRefreshedLinkedInTokens(
  db: Firestore,
  integrationId: string,
  accessToken: string,
  expiresAt?: Date
): Promise<void> {
  const { encrypted, iv } = encrypt(accessToken);
  const updateData: Record<string, unknown> = {
    access_token_enc: encrypted,
    token_iv: iv,
  };

  if (expiresAt) {
    updateData.token_expires_at = expiresAt.toISOString();
  }

  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update(updateData);
}
