import { createHash, createHmac, createPublicKey, timingSafeEqual, verify } from "crypto";
import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type WorkChannelConnection,
  type WorkChannelMessage,
  type WorkChannelProvider,
} from "@/lib/firebase/schema";
import { decrypt, encrypt } from "@/lib/utils/encryption";
import { normalizeTrustedScope } from "./trusted";

type ChannelConfig = Record<string, unknown>;
type ChannelCredentials = Record<string, string>;

export type ChannelAdapter = {
  provider: WorkChannelProvider;
  label: string;
  requiredCredentials: string[];
  optionalCredentials?: string[];
  limits: Record<string, unknown>;
  validateConfig(config: ChannelConfig, credentials: ChannelCredentials): string[];
  normalizeInbound(payload: unknown, headers: Headers): NormalizedInboundMessage[];
  verifyWebhook(payload: string, headers: Headers, credentials: ChannelCredentials, config: ChannelConfig): boolean;
  send(connection: WorkChannelConnection, credentials: ChannelCredentials, text: string): Promise<ChannelSendResult>;
  health(credentials: ChannelCredentials): Promise<ChannelHealthResult>;
};

export type NormalizedInboundMessage = {
  externalMessageId: string | null;
  externalChannelId: string | null;
  senderId: string | null;
  text: string | null;
  payload: Record<string, unknown>;
};

export type ChannelSendResult = {
  ok: boolean;
  providerMessageId?: string | null;
  error?: string;
};

export type ChannelHealthResult = {
  ok: boolean;
  status: "configured" | "missing_credentials" | "unreachable";
  detail?: string;
};

const PROVIDERS: WorkChannelProvider[] = [
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "wechat",
  "dingtalk",
  "lark",
];

function nowIso() {
  return new Date().toISOString();
}

function readString(value: unknown, fallback = "", maxLength = 2000) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function providerFromString(value: unknown): WorkChannelProvider | null {
  return typeof value === "string" && PROVIDERS.includes(value as WorkChannelProvider)
    ? (value as WorkChannelProvider)
    : null;
}

function safeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function safeStringRecord(value: unknown): Record<string, string> {
  return Object.fromEntries(
    Object.entries(safeRecord(value)).filter(
      (entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string"
    )
  );
}

function safeJsonPayload(value: unknown): Record<string, unknown> {
  return safeRecord(value);
}

function safeCompare(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function getNestedString(value: unknown, path: string[]) {
  let cursor: unknown = value;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || Array.isArray(cursor)) return null;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === "string" || typeof cursor === "number" ? String(cursor) : null;
}

function getEnvCredentials(provider: WorkChannelProvider): ChannelCredentials {
  switch (provider) {
    case "telegram":
      return {
        botToken: process.env.TELEGRAM_BOT_TOKEN || "",
        webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || "",
      };
    case "discord":
      return {
        botToken: process.env.DISCORD_BOT_TOKEN || "",
        publicKey: process.env.DISCORD_PUBLIC_KEY || "",
        webhookUrl: process.env.DISCORD_WEBHOOK_URL || "",
      };
    case "slack":
      return {
        botToken: process.env.SLACK_BOT_TOKEN || "",
        signingSecret: process.env.SLACK_SIGNING_SECRET || "",
      };
    case "whatsapp":
      return {
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN || "",
        appSecret: process.env.WHATSAPP_APP_SECRET || "",
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN || "",
      };
    case "wechat":
      return {
        token: process.env.WECHAT_TOKEN || "",
        appSecret: process.env.WECHAT_APP_SECRET || "",
      };
    case "dingtalk":
      return {
        robotAccessToken: process.env.DINGTALK_ROBOT_ACCESS_TOKEN || "",
        robotSecret: process.env.DINGTALK_ROBOT_SECRET || "",
        appKey: process.env.DINGTALK_APP_KEY || "",
        appSecret: process.env.DINGTALK_APP_SECRET || "",
      };
    case "lark":
      return {
        appId: process.env.LARK_APP_ID || "",
        appSecret: process.env.LARK_APP_SECRET || "",
        verificationToken: process.env.LARK_VERIFICATION_TOKEN || "",
        encryptKey: process.env.LARK_ENCRYPT_KEY || "",
      };
  }
}

function mergeCredentials(provider: WorkChannelProvider, encrypted?: string | null, iv?: string | null) {
  const envCredentials = getEnvCredentials(provider);
  if (!encrypted || !iv) {
    return envCredentials;
  }

  try {
    const parsed: unknown = JSON.parse(decrypt(encrypted, iv));
    const stored = safeStringRecord(parsed);
    return { ...envCredentials, ...stored };
  } catch {
    return envCredentials;
  }
}

function encryptCredentials(credentials: ChannelCredentials) {
  const clean = Object.fromEntries(
    Object.entries(credentials).filter(([, value]) => typeof value === "string" && value.trim())
  );
  if (Object.keys(clean).length === 0) {
    return { credential_enc: null, credential_iv: null, credential_hint: {} };
  }
  const encrypted = encrypt(JSON.stringify(clean));
  return {
    credential_enc: encrypted.encrypted,
    credential_iv: encrypted.iv,
    credential_hint: Object.fromEntries(
      Object.keys(clean).map((key) => [key, "configured"])
    ),
  };
}

function missingCredentials(credentials: ChannelCredentials, required: string[]) {
  return required.filter((key) => !credentials[key]);
}

function firstMessage(payload: unknown) {
  if (Array.isArray(payload)) {
    return safeRecord(payload[0]);
  }
  return safeRecord(payload);
}

function genericNormalize(provider: WorkChannelProvider, payload: unknown): NormalizedInboundMessage[] {
  const event = firstMessage(payload);
  return [
    {
      externalMessageId: readString(event.message_id || event.id, "") || null,
      externalChannelId: readString(event.channel_id || event.chat_id || event.conversation_id, "") || null,
      senderId: readString(event.user_id || event.sender_id || event.from, "") || null,
      text: readString(event.text || event.content || event.message, "") || null,
      payload: { provider, raw: safeJsonPayload(payload) },
    },
  ];
}

function makeAdapter(config: {
  provider: WorkChannelProvider;
  label: string;
  requiredCredentials: string[];
  optionalCredentials?: string[];
  limits: Record<string, unknown>;
  normalizeInbound?: ChannelAdapter["normalizeInbound"];
  verifyWebhook?: ChannelAdapter["verifyWebhook"];
  send: ChannelAdapter["send"];
}): ChannelAdapter {
  return {
    provider: config.provider,
    label: config.label,
    requiredCredentials: config.requiredCredentials,
    optionalCredentials: config.optionalCredentials,
    limits: config.limits,
    validateConfig: (_adapterConfig, credentials) =>
      missingCredentials(credentials, config.requiredCredentials).map(
        (name) => `${name} is required.`
      ),
    normalizeInbound:
      config.normalizeInbound ||
      ((payload) => genericNormalize(config.provider, payload)),
    verifyWebhook:
      config.verifyWebhook ||
      ((_payload, _headers, _credentials) => true),
    send: config.send,
    health: async (credentials) => {
      const missing = missingCredentials(credentials, config.requiredCredentials);
      return missing.length
        ? {
            ok: false,
            status: "missing_credentials",
            detail: `Missing ${missing.join(", ")}`,
          }
        : { ok: true, status: "configured" };
    },
  };
}

async function postJson(url: string, headers: HeadersInit, body: Record<string, unknown>) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  return { response, payload };
}

const ADAPTERS: Record<WorkChannelProvider, ChannelAdapter> = {
  telegram: makeAdapter({
    provider: "telegram",
    label: "Telegram",
    requiredCredentials: ["botToken"],
    optionalCredentials: ["webhookSecret"],
    limits: { maxTextLength: 4096 },
    normalizeInbound: (payload) => [
      {
        externalMessageId: getNestedString(payload, ["message", "message_id"]),
        externalChannelId: getNestedString(payload, ["message", "chat", "id"]),
        senderId: getNestedString(payload, ["message", "from", "id"]),
        text: getNestedString(payload, ["message", "text"]),
        payload: safeJsonPayload(payload),
      },
    ],
    verifyWebhook: (_payload, headers, credentials) => {
      if (!credentials.webhookSecret) return true;
      return safeCompare(
        headers.get("x-telegram-bot-api-secret-token") || "",
        credentials.webhookSecret
      );
    },
    send: async (connection, credentials, text) => {
      const channelId = connection.external_channel_id || readString(connection.config?.chatId, "");
      if (!credentials.botToken || !channelId) {
        return { ok: false, error: "Telegram botToken and chatId are required." };
      }
      const { response, payload } = await postJson(
        `https://api.telegram.org/bot${credentials.botToken}/sendMessage`,
        {},
        { chat_id: channelId, text: text.slice(0, 4096) }
      );
      return response.ok
        ? { ok: true, providerMessageId: String((payload as { result?: { message_id?: unknown } }).result?.message_id || "") }
        : { ok: false, error: JSON.stringify(payload).slice(0, 1000) };
    },
  }),
  discord: makeAdapter({
    provider: "discord",
    label: "Discord",
    requiredCredentials: [],
    optionalCredentials: ["botToken", "publicKey", "webhookUrl"],
    limits: { maxTextLength: 2000 },
    verifyWebhook: (payload, headers, credentials) => {
      if (!credentials.publicKey) return true;
      const signature = headers.get("x-signature-ed25519") || "";
      const timestamp = headers.get("x-signature-timestamp") || "";
      if (!signature || !timestamp) return false;
      try {
        const publicKey = createPublicKey({
          key: Buffer.concat([
            Buffer.from("302a300506032b6570032100", "hex"),
            Buffer.from(credentials.publicKey, "hex"),
          ]),
          format: "der",
          type: "spki",
        });
        return verify(null, Buffer.from(`${timestamp}${payload}`), publicKey, Buffer.from(signature, "hex"));
      } catch {
        return false;
      }
    },
    send: async (_connection, credentials, text) => {
      if (!credentials.webhookUrl) {
        return { ok: false, error: "Discord webhookUrl is required for outbound sends." };
      }
      const { response, payload } = await postJson(
        credentials.webhookUrl,
        {},
        { content: text.slice(0, 2000) }
      );
      return response.ok || response.status === 204
        ? { ok: true, providerMessageId: readString((payload as { id?: unknown }).id, "") || null }
        : { ok: false, error: JSON.stringify(payload).slice(0, 1000) };
    },
  }),
  slack: makeAdapter({
    provider: "slack",
    label: "Slack",
    requiredCredentials: ["botToken", "signingSecret"],
    limits: { maxTextLength: 40000 },
    normalizeInbound: (payload) => {
      const event = safeRecord(safeRecord(payload).event);
      return [
        {
          externalMessageId: readString(event.ts, "") || null,
          externalChannelId: readString(event.channel, "") || null,
          senderId: readString(event.user, "") || null,
          text: readString(event.text, "") || null,
          payload: safeJsonPayload(payload),
        },
      ];
    },
    verifyWebhook: (payload, headers, credentials) => {
      if (!credentials.signingSecret) return false;
      const timestamp = headers.get("x-slack-request-timestamp") || "";
      const signature = headers.get("x-slack-signature") || "";
      if (!timestamp || !signature) return false;
      const expected = `v0=${createHmac("sha256", credentials.signingSecret)
        .update(`v0:${timestamp}:${payload}`)
        .digest("hex")}`;
      return safeCompare(signature, expected);
    },
    send: async (connection, credentials, text) => {
      const channel = connection.external_channel_id || readString(connection.config?.channelId, "");
      if (!credentials.botToken || !channel) {
        return { ok: false, error: "Slack botToken and channelId are required." };
      }
      const { response, payload } = await postJson(
        "https://slack.com/api/chat.postMessage",
        { Authorization: `Bearer ${credentials.botToken}` },
        { channel, text: text.slice(0, 40000) }
      );
      return response.ok && (payload as { ok?: boolean }).ok !== false
        ? { ok: true, providerMessageId: readString((payload as { ts?: unknown }).ts, "") || null }
        : { ok: false, error: JSON.stringify(payload).slice(0, 1000) };
    },
  }),
  whatsapp: makeAdapter({
    provider: "whatsapp",
    label: "WhatsApp Cloud API",
    requiredCredentials: ["accessToken", "phoneNumberId", "verifyToken"],
    optionalCredentials: ["appSecret"],
    limits: { maxTextLength: 4096 },
    normalizeInbound: (payload) => {
      const value =
        safeRecord(
          (safeRecord((safeRecord(payload).entry as unknown[] | undefined)?.[0]).changes as unknown[] | undefined)?.[0]
        ).value || {};
      const message = safeRecord((safeRecord(value).messages as unknown[] | undefined)?.[0]);
      return [
        {
          externalMessageId: readString(message.id, "") || null,
          externalChannelId: readString(safeRecord(value).metadata && (safeRecord(value).metadata as Record<string, unknown>).phone_number_id, "") || null,
          senderId: readString(message.from, "") || null,
          text: getNestedString(message, ["text", "body"]),
          payload: safeJsonPayload(payload),
        },
      ];
    },
    verifyWebhook: (payload, headers, credentials) => {
      if (!credentials.appSecret) return true;
      const signature = headers.get("x-hub-signature-256") || "";
      const expected = `sha256=${createHmac("sha256", credentials.appSecret).update(payload).digest("hex")}`;
      return safeCompare(signature, expected);
    },
    send: async (connection, credentials, text) => {
      const to = connection.external_channel_id || readString(connection.config?.recipientPhone, "");
      if (!credentials.accessToken || !credentials.phoneNumberId || !to) {
        return { ok: false, error: "WhatsApp accessToken, phoneNumberId, and recipientPhone are required." };
      }
      const { response, payload } = await postJson(
        `https://graph.facebook.com/v20.0/${credentials.phoneNumberId}/messages`,
        { Authorization: `Bearer ${credentials.accessToken}` },
        {
          messaging_product: "whatsapp",
          to,
          type: "text",
          text: { body: text.slice(0, 4096) },
        }
      );
      const messages = (payload as { messages?: Array<{ id?: string }> }).messages || [];
      return response.ok
        ? { ok: true, providerMessageId: messages[0]?.id || null }
        : { ok: false, error: JSON.stringify(payload).slice(0, 1000) };
    },
  }),
  wechat: makeAdapter({
    provider: "wechat",
    label: "WeChat",
    requiredCredentials: ["token", "appSecret"],
    limits: { maxTextLength: 2048 },
    verifyWebhook: (_payload, headers, credentials, config) => {
      const signature = headers.get("x-wechat-signature") || headers.get("signature") || "";
      const timestamp = headers.get("x-wechat-timestamp") || headers.get("timestamp") || readString(config.timestamp, "");
      const nonce = headers.get("x-wechat-nonce") || headers.get("nonce") || readString(config.nonce, "");
      if (!credentials.token || !signature || !timestamp || !nonce) return false;
      const expected = createHashCompat([credentials.token, timestamp, nonce].sort().join(""));
      return safeCompare(signature, expected);
    },
    send: async () => ({
      ok: false,
      error: "WeChat outbound send requires app-specific access token exchange; credentials shell is configured.",
    }),
  }),
  dingtalk: makeAdapter({
    provider: "dingtalk",
    label: "DingTalk",
    requiredCredentials: [],
    optionalCredentials: ["robotAccessToken", "robotSecret", "appKey", "appSecret"],
    limits: { maxTextLength: 4096 },
    send: async (_connection, credentials, text) => {
      if (!credentials.robotAccessToken) {
        return { ok: false, error: "DingTalk robotAccessToken is required for robot sends." };
      }
      const timestamp = Date.now();
      const sign = credentials.robotSecret
        ? `&timestamp=${timestamp}&sign=${encodeURIComponent(
            createHmac("sha256", credentials.robotSecret)
              .update(`${timestamp}\n${credentials.robotSecret}`)
              .digest("base64")
          )}`
        : "";
      const { response, payload } = await postJson(
        `https://oapi.dingtalk.com/robot/send?access_token=${credentials.robotAccessToken}${sign}`,
        {},
        { msgtype: "text", text: { content: text.slice(0, 4096) } }
      );
      return response.ok && Number((payload as { errcode?: unknown }).errcode || 0) === 0
        ? { ok: true, providerMessageId: null }
        : { ok: false, error: JSON.stringify(payload).slice(0, 1000) };
    },
  }),
  lark: makeAdapter({
    provider: "lark",
    label: "Lark",
    requiredCredentials: ["appId", "appSecret"],
    optionalCredentials: ["verificationToken", "encryptKey"],
    limits: { maxTextLength: 4096 },
    verifyWebhook: (_payload, _headers, credentials, config) => {
      if (!credentials.verificationToken) return true;
      return readString(config.token, credentials.verificationToken) === credentials.verificationToken;
    },
    send: async () => ({
      ok: false,
      error: "Lark outbound send requires tenant access-token exchange; credentials shell is configured.",
    }),
  }),
};

function createHashCompat(value: string) {
  return createHash("sha1").update(value).digest("hex");
}

export function getChannelCatalog() {
  return PROVIDERS.map((provider) => {
    const adapter = ADAPTERS[provider];
    const envCredentials = getEnvCredentials(provider);
    const missing = missingCredentials(envCredentials, adapter.requiredCredentials);
    return {
      provider,
      label: adapter.label,
      status: missing.length === 0 ? "configured" : "planned",
      requiredCredentials: adapter.requiredCredentials,
      optionalCredentials: adapter.optionalCredentials || [],
      limits: adapter.limits,
    };
  });
}

export function getChannelAdapter(provider: WorkChannelProvider) {
  return ADAPTERS[provider];
}

export async function listChannelConnections(db: Firestore, userId: string) {
  const snapshot = await db
    .collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS)
    .where("user_id", "==", userId)
    .get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((left, right) =>
      String((right as { updated_at?: unknown }).updated_at || "").localeCompare(
        String((left as { updated_at?: unknown }).updated_at || "")
      )
    );
}

export async function createChannelConnection(
  db: Firestore,
  userId: string,
  input: Record<string, unknown>
) {
  const provider = providerFromString(input.provider);
  if (!provider) {
    throw new Error("Unsupported channel provider.");
  }
  const adapter = getChannelAdapter(provider);
  const config = safeRecord(input.config);
  const credentials = Object.fromEntries(
    Object.entries(safeRecord(input.credentials)).map(([key, value]) => [key, readString(value, "")])
  );
  const mergedCredentials = { ...getEnvCredentials(provider), ...credentials };
  const errors = adapter.validateConfig(config, mergedCredentials);
  if (errors.length > 0) {
    throw new Error(errors.join(" "));
  }

  const encrypted = encryptCredentials(credentials);
  const now = nowIso();
  const ref = db.collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS).doc();
  const connection = {
    user_id: userId,
    provider,
    label: readString(input.label, adapter.label, 120),
    status: "configured",
    agent_id: readString(input.agentId, "") || null,
    team_id: readString(input.teamId, "") || null,
    external_channel_id: readString(input.externalChannelId, "") || null,
    config,
    ...encrypted,
    auto_reply_enabled: Boolean(input.autoReplyEnabled),
    trusted_scope: normalizeTrustedScope(input.trustedScope),
    last_auto_executed_at: null,
    last_health: null,
    last_message_at: null,
    created_at: now,
    updated_at: now,
  };

  await ref.set(connection);
  return { id: ref.id, ...connection };
}

export async function deleteChannelConnection(db: Firestore, userId: string, connectionId: string) {
  const ref = db.collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS).doc(connectionId);
  const snapshot = await ref.get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.user_id !== userId) {
    return false;
  }
  await ref.delete();
  return true;
}

export async function getChannelConnection(db: Firestore, userId: string, connectionId: string) {
  const snapshot = await db.collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS).doc(connectionId).get();
  const data = snapshot.data();
  if (!snapshot.exists || !data || data.user_id !== userId) {
    return null;
  }
  return { id: snapshot.id, ...data } as WorkChannelConnection;
}

export async function testChannelConnection(db: Firestore, userId: string, connectionId: string) {
  const connection = await getChannelConnection(db, userId, connectionId);
  if (!connection) return null;
  const adapter = getChannelAdapter(connection.provider);
  const credentials = mergeCredentials(connection.provider, connection.credential_enc, connection.credential_iv);
  const health = await adapter.health(credentials);
  await db.collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS).doc(connection.id).set(
    {
      status: health.ok ? "active" : "error",
      last_health: health,
      updated_at: nowIso(),
    },
    { merge: true }
  );
  return health;
}

export async function sendChannelMessage(
  db: Firestore,
  userId: string,
  connectionId: string,
  text: string,
  options: { approved?: boolean } = {}
) {
  const connection = await getChannelConnection(db, userId, connectionId);
  if (!connection) return null;
  const now = nowIso();

  const trustedAutoReply =
    connection.auto_reply_enabled && normalizeTrustedScope(connection.trusted_scope) === "trusted";

  if (!trustedAutoReply && !options.approved) {
    const messageRef = db.collection(COLLECTIONS.WORK_CHANNEL_MESSAGES).doc();
    const message: WorkChannelMessage = {
      id: messageRef.id,
      user_id: userId,
      connection_id: connection.id,
      provider: connection.provider,
      direction: "outbound",
      external_message_id: null,
      external_channel_id: connection.external_channel_id ?? null,
      sender_id: userId,
      text,
      payload: { approvalRequired: true },
      status: "queued",
      error: null,
      agent_event_id: null,
      created_at: now,
      updated_at: now,
    };
    await messageRef.set(message);
    return {
      ok: false,
      approvalRequired: true,
      message,
      error: "Outbound channel sends require approval unless trusted auto-reply is enabled.",
    };
  }

  const adapter = getChannelAdapter(connection.provider);
  const credentials = mergeCredentials(connection.provider, connection.credential_enc, connection.credential_iv);
  const result = await adapter.send(connection, credentials, text);
  const messageRef = db.collection(COLLECTIONS.WORK_CHANNEL_MESSAGES).doc();
  const message: WorkChannelMessage = {
    id: messageRef.id,
    user_id: userId,
    connection_id: connection.id,
    provider: connection.provider,
    direction: "outbound",
    external_message_id: result.providerMessageId ?? null,
    external_channel_id: connection.external_channel_id ?? null,
    sender_id: userId,
    text,
    payload: { result },
    status: result.ok ? "sent" : "failed",
    error: result.error ?? null,
    agent_event_id: null,
    created_at: now,
    updated_at: now,
  };
  await messageRef.set(message);
  if (trustedAutoReply) {
    await db.collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS).doc(connection.id).set(
      { last_auto_executed_at: now, updated_at: now },
      { merge: true }
    );
  }
  return { ok: result.ok, message, error: result.error };
}

export async function persistInboundChannelMessages(
  db: Firestore,
  userId: string,
  provider: WorkChannelProvider,
  messages: NormalizedInboundMessage[]
) {
  const now = nowIso();
  const batch = db.batch();
  const docs = messages.map((message) => {
    const ref = db.collection(COLLECTIONS.WORK_CHANNEL_MESSAGES).doc();
    const record: WorkChannelMessage = {
      id: ref.id,
      user_id: userId,
      connection_id: null,
      provider,
      direction: "inbound",
      external_message_id: message.externalMessageId,
      external_channel_id: message.externalChannelId,
      sender_id: message.senderId,
      text: message.text,
      payload: message.payload,
      status: "received",
      error: null,
      agent_event_id: null,
      created_at: now,
      updated_at: now,
    };
    batch.set(ref, record);
    return record;
  });
  await batch.commit();
  return docs;
}

export function resolveWebhookVerification(
  provider: WorkChannelProvider,
  payload: string,
  headers: Headers,
  credentials: ChannelCredentials,
  config: ChannelConfig = {}
) {
  return getChannelAdapter(provider).verifyWebhook(payload, headers, credentials, config);
}

export function getProviderEnvCredentials(provider: WorkChannelProvider) {
  return getEnvCredentials(provider);
}

export function hasProviderWebhookVerification(
  provider: WorkChannelProvider,
  credentials: ChannelCredentials
) {
  switch (provider) {
    case "telegram":
      return Boolean(credentials.webhookSecret);
    case "discord":
      return Boolean(credentials.publicKey);
    case "slack":
      return Boolean(credentials.signingSecret);
    case "whatsapp":
      return Boolean(credentials.appSecret);
    case "wechat":
      return Boolean(credentials.token);
    case "dingtalk":
      return Boolean(credentials.robotSecret || credentials.appSecret);
    case "lark":
      return Boolean(credentials.verificationToken);
  }
}

export function resolveInboundChannelUserId(
  connections: Array<{
    user_id?: string;
    status?: string;
    external_channel_id?: string | null;
  }>,
  channelId: string | null
) {
  if (!channelId) return null;
  const matched = connections.find(
    (connection) =>
      connection.status !== "error" && connection.external_channel_id === channelId
  );
  return typeof matched?.user_id === "string" ? matched.user_id : null;
}
