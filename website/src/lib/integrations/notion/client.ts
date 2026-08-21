import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const NOTION_API_BASE = "https://api.notion.com/v1";

export interface NotionConfig {
  accessToken: string;
}

export interface NotionPage {
  id: string;
  title: string;
  url: string;
  parent?: Record<string, unknown>;
  lastEditedAt?: string;
}

export interface NotionDatabase {
  id: string;
  title: string;
  url: string;
  description?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

export async function exchangeNotionCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string }> {
  const clientId = process.env.NOTION_CLIENT_ID;
  const clientSecret = process.env.NOTION_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Notion OAuth credentials.");
  }

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  const data: unknown = await res.json().catch(() => null);
  const payload = isRecord(data) ? data : {};
  const accessToken = optionalString(payload.access_token);

  if (!accessToken) {
    throw new Error("Notion OAuth response did not include an access token.");
  }

  return { accessToken };
}

export async function notionApiCall<T>(
  config: NotionConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const res = await fetch(`${NOTION_API_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Notion-Version": "2022-06-28",
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Notion API error (${res.status}): ${text}`);
  }

  return (await res.json()) as T;
}

function extractPageTitle(properties: Record<string, unknown> | undefined): string {
  if (!properties) return "(untitled)";
  for (const value of Object.values(properties)) {
    if (!isRecord(value)) continue;
    if (value.title && Array.isArray(value.title)) {
      const titleParts = (value.title as Array<{ plain_text?: string }>)
        .map((part) => part.plain_text || "")
        .join("");
      if (titleParts) return titleParts;
    }
  }
  return "(untitled)";
}

export async function searchNotion(
  config: NotionConfig,
  query = "",
  pageSize = 20,
): Promise<Array<NotionPage | NotionDatabase>> {
  const data = await notionApiCall<{
    results?: Array<Record<string, unknown>>;
  }>(config, "search", {
    method: "POST",
    body: JSON.stringify({
      query,
      page_size: pageSize,
      filter: { property: "object", value: "page" },
    }),
  });

  const results = Array.isArray(data.results) ? data.results : [];
  return results
    .filter((item) => item.object === "page")
    .map((item) => ({
      id: optionalString(item.id) || "",
      title: extractPageTitle(item.properties as Record<string, unknown> | undefined),
      url: optionalString(item.url) || "",
      parent: isRecord(item.parent) ? item.parent : undefined,
      lastEditedAt: optionalString(item.last_edited_time),
    }));
}

export async function createNotionPage(
  config: NotionConfig,
  parentPageId: string,
  title: string,
  content?: string,
): Promise<{ id: string; url: string }> {
  const children =
    content && content.trim()
      ? [
          {
            object: "block",
            type: "paragraph",
            paragraph: {
              rich_text: [
                {
                  type: "text",
                  text: { content: content.slice(0, 2000) },
                },
              ],
            },
          },
        ]
      : [];

  const data = await notionApiCall<{ id?: string; url?: string }>(config, "pages", {
    method: "POST",
    body: JSON.stringify({
      parent: { type: "page_id", page_id: parentPageId },
      properties: {
        title: {
          title: [{ type: "text", text: { content: title.slice(0, 200) } }],
        },
      },
      children,
    }),
  });

  return {
    id: optionalString(data.id) || "",
    url: optionalString(data.url) || "",
  };
}

export async function appendNotionBlock(
  config: NotionConfig,
  pageId: string,
  content: string,
): Promise<{ ok: boolean }> {
  await notionApiCall(config, `blocks/${pageId}/children`, {
    method: "PATCH",
    body: JSON.stringify({
      children: [
        {
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [
              {
                type: "text",
                text: { content: content.slice(0, 2000) },
              },
            ],
          },
        },
      ],
    }),
  });

  return { ok: true };
}

export async function persistNotionConnection(
  db: Firestore,
  userId: string,
  accessToken: string,
  scopes: string[],
): Promise<string> {
  const { encrypted, iv } = encrypt(accessToken);
  const ref = db.collection(COLLECTIONS.INTEGRATIONS).doc();

  await ref.set({
    id: ref.id,
    user_id: userId,
    provider: "notion",
    provider_account_id: null,
    provider_account_name: "Notion",
    access_token_enc: encrypted,
    token_iv: iv,
    scopes,
    token_expires_at: null,
    status: "active",
    last_synced_at: null,
    sync_cursor: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  return ref.id;
}
