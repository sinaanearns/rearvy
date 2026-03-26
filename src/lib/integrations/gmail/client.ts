import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export interface GmailConfig {
  accessToken: string;
  refreshToken: string;
  tokenExpiresAt: Date;
}

export interface RefreshedTokens {
  accessToken: string;
  expiresAt: Date;
}

export interface GmailThread {
  id: string;
  snippet: string;
  historyId: string;
  messages?: GmailMessageRaw[];
}

export interface GmailMessageRaw {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  historyId: string;
  internalDate: string;
  payload: {
    partId: string;
    mimeType: string;
    filename: string;
    headers: Array<{ name: string; value: string }>;
    body: { size: number; data?: string };
    parts?: any[];
  };
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<RefreshedTokens> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Gmail token refresh failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  };
}

export async function ensureValidToken(
  db: Firestore,
  integrationId: string,
  config: GmailConfig
): Promise<string> {
  const now = new Date();
  const bufferMinutes = 5;
  const expiresWithBuffer = new Date(
    config.tokenExpiresAt.getTime() - bufferMinutes * 60 * 1000
  );

  if (now < expiresWithBuffer) {
    return config.accessToken;
  }

  const { accessToken, expiresAt } = await refreshAccessToken(
    config.refreshToken
  );

  const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(accessToken);

  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .update({
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      token_expires_at: expiresAt.toISOString(),
    });

  return accessToken;
}

export async function fetchThreads(
  config: GmailConfig,
  historyId?: string,
  maxResults = 100,
  pageToken?: string
): Promise<{ threads: GmailThread[]; nextPageToken?: string }> {
  const url = new URL(`${GMAIL_API_BASE}/threads`);
  url.searchParams.set("maxResults", maxResults.toString());
  
  // Exclude chats/drafts. We want INBOX or SENT, or maybe just everything not DRAFT/TRASH.
  // For support we mainly care about user emails (INBOX) and our replies (SENT).
  url.searchParams.set("q", "-in:chats -in:drafts -in:trash");
  
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Gmail threads: ${res.status} ${text}`);
  }

  const data = await res.json();
  return {
    threads: data.threads || [],
    nextPageToken: data.nextPageToken,
  };
}

export async function fetchThreadDetails(
  config: GmailConfig,
  threadId: string
): Promise<GmailThread> {
  const res = await fetch(`${GMAIL_API_BASE}/threads/${threadId}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
  });

  if (!res.ok) {
    if (res.status === 404) return null as any; // Ignore deleted threads
    const text = await res.text();
    throw new Error(`Failed to fetch Gmail thread ${threadId}: ${res.status} ${text}`);
  }

  return res.json();
}

/**
 * Extracts plain text from the message payload body
 */
export function extractTextBody(payload: any): string {
  if (!payload) return "";

  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return Buffer.from(payload.body.data, "base64").toString("utf8");
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      const text = extractTextBody(part);
      if (text) return text;
    }
  }

  return "";
}

/**
 * Gets a specific header value
 */
export function getHeader(headers: Array<{ name: string; value: string }>, name: string): string {
  const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
  return header ? header.value : "";
}
