import { Firestore } from "firebase-admin/firestore";
import { encrypt } from "@/lib/utils/encryption";
import { COLLECTIONS } from "@/lib/firebase/schema";

const SLACK_API_BASE = "https://slack.com/api";

export interface SlackConfig {
  accessToken: string;
  botUserId?: string;
  teamId?: string;
}

export interface SlackChannel {
  id: string;
  name: string;
  isChannel: boolean;
  isPrivate: boolean;
  isArchived: boolean;
  numMembers?: number;
  topic?: string;
  purpose?: string;
}

export interface SlackMessage {
  ts: string;
  user?: string;
  text: string;
  threadTs?: string;
  channel: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function optionalString(value: unknown) {
  return typeof value === "string" && value ? value : undefined;
}

function optionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

export async function exchangeSlackCode(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; botUserId?: string; teamId?: string; userId?: string }> {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing Slack OAuth credentials. Set SLACK_CLIENT_ID and SLACK_CLIENT_SECRET.");
  }

  const res = await fetch(`${SLACK_API_BASE}/api/oauth.v2.access`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }).toString(),
  });

  const data: unknown = await res.json().catch(() => null);
  const payload = isRecord(data) ? data : {};
  const authedUser = isRecord(payload.authed_user) ? payload.authed_user : {};
  const team = isRecord(payload.team) ? payload.team : {};

  if (!payload.ok) {
    const errorMsg = optionalString(payload.error) || "slack_oauth_failed";
    throw new Error(`Slack OAuth failed: ${errorMsg}`);
  }

  const accessToken = optionalString(authedUser.access_token) || optionalString(payload.access_token);
  if (!accessToken) {
    throw new Error("Slack OAuth response did not include an access token.");
  }

  return {
    accessToken,
    botUserId: optionalString(payload.bot_user_id),
    teamId: optionalString(team.id),
    userId: optionalString(authedUser.id),
  };
}

export async function slackApiCall<T>(
  config: SlackConfig,
  method: string,
  params: Record<string, string | number | boolean> = {},
): Promise<T> {
  const url = new URL(`${SLACK_API_BASE}/${method}`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, String(value));
  }

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  const data: unknown = await res.json().catch(() => null);
  const payload = isRecord(data) ? data : {};

  if (payload.ok !== true) {
    const errorMsg = optionalString(payload.error) || `Slack ${method} failed`;
    throw new Error(errorMsg);
  }

  return payload as T;
}

export async function slackPostMessage(
  config: SlackConfig,
  channel: string,
  text: string,
  threadTs?: string,
): Promise<{ ok: boolean; ts?: string; error?: string }> {
  const url = new URL(`${SLACK_API_BASE}/chat.postMessage`);
  const body = new URLSearchParams({
    channel,
    text,
    ...(threadTs ? { thread_ts: threadTs } : {}),
  });

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });

  const data: unknown = await res.json().catch(() => null);
  const payload = isRecord(data) ? data : {};

  if (payload.ok !== true) {
    return { ok: false, error: optionalString(payload.error) || "chat.postMessage failed" };
  }

  return { ok: true, ts: optionalString(payload.ts) };
}

export async function listSlackChannels(
  config: SlackConfig,
  excludeArchived = true,
): Promise<SlackChannel[]> {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const params: Record<string, string | number | boolean> = {
      limit: 200,
      exclude_archived: excludeArchived,
    };
    if (cursor) params.cursor = cursor;

    const data = await slackApiCall<Record<string, unknown>>(config, "conversations.list", params);
    const rawChannels = Array.isArray(data.channels) ? data.channels : [];

    for (const raw of rawChannels) {
      if (!isRecord(raw)) continue;
      const topic = isRecord(raw.topic) ? raw.topic : {};
      const purpose = isRecord(raw.purpose) ? raw.purpose : {};
      channels.push({
        id: optionalString(raw.id) || "",
        name: optionalString(raw.name) || "",
        isChannel: raw.is_channel === true,
        isPrivate: raw.is_private === true,
        isArchived: raw.is_archived === true,
        numMembers: optionalNumber(raw.num_members),
        topic: optionalString(topic.value),
        purpose: optionalString(purpose.value),
      });
    }

    const responseMetadata = isRecord(data.response_metadata) ? data.response_metadata : {};
    cursor = optionalString(responseMetadata.next_cursor) || undefined;
  } while (cursor && channels.length < 1000);

  return channels;
}

export async function readSlackChannelHistory(
  config: SlackConfig,
  channel: string,
  limit = 50,
): Promise<SlackMessage[]> {
  const data = await slackApiCall<Record<string, unknown>>(config, "conversations.history", {
    channel,
    limit,
  });

  const rawMessages = Array.isArray(data.messages) ? data.messages : [];
  return rawMessages
    .filter(isRecord)
    .map((raw) => ({
      ts: optionalString(raw.ts) || "",
      user: optionalString(raw.user),
      text: optionalString(raw.text) || "",
      threadTs: optionalString(raw.thread_ts),
      channel,
    }));
}

export async function persistSlackConnection(
  db: Firestore,
  userId: string,
  teamId: string | undefined,
  accessToken: string,
  scopes: string[],
) {
  const { encrypted, iv } = encrypt(accessToken);

  const ref = db.collection(COLLECTIONS.INTEGRATIONS).doc();
  await ref.set({
    id: ref.id,
    user_id: userId,
    provider: "slack",
    provider_account_id: teamId || null,
    provider_account_name: teamId || "Slack",
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
