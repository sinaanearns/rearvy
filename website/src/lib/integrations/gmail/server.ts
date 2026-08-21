import type { Firestore } from "firebase-admin/firestore";
import {
  COLLECTIONS,
  type Integration,
} from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import {
  ensureValidToken,
  type GmailConfig,
} from "@/lib/integrations/gmail/client";
import type {
  GmailComposeCapabilities,
  GmailComposePayload,
  GmailSendAsOption,
} from "./compose-shared";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

type GmailIntegrationRecord = Integration & {
  sync_cursor?: {
    refresh_iv?: string;
  };
};

type GmailApiFailure = {
  ok: false;
  status: number;
  message: string;
};

type GmailApiSuccess<T> = {
  ok: true;
  data: T;
};

type GmailConnectionSuccess = {
  ok: true;
  integrationId: string;
  integration: GmailIntegrationRecord;
  config: GmailConfig;
  accountName: string;
};

type GmailConnectionFailure = {
  ok: false;
  errorCode: string;
  message: string;
};

type GmailSendAsApiRecord = {
  sendAsEmail?: unknown;
  displayName?: unknown;
  isPrimary?: unknown;
  isDefault?: unknown;
  replyToAddress?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function readGmailApiPayload(response: Response): Promise<Record<string, unknown>> {
  const payload: unknown = await response.json().catch(() => null);
  return isRecord(payload) ? payload : {};
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function encodeHeaderValue(value: string) {
  const sanitized = sanitizeHeaderValue(value);
  if (!sanitized) {
    return sanitized;
  }

  return /[^\x20-\x7E]/.test(sanitized)
    ? `=?UTF-8?B?${Buffer.from(sanitized, "utf8").toString("base64")}?=`
    : sanitized;
}

function quoteDisplayName(value: string) {
  return `"${value.replace(/(["\\])/g, "\\$1")}"`;
}

function formatMailbox(option: GmailSendAsOption) {
  const email = sanitizeHeaderValue(option.email);
  const displayName = normalizeText(option.displayName);

  if (!displayName) {
    return email;
  }

  const encodedDisplayName = /[^\x20-\x7E]/.test(displayName)
    ? encodeHeaderValue(displayName)
    : quoteDisplayName(displayName);

  return `${encodedDisplayName} <${email}>`;
}

function formatRecipients(values: string[]) {
  return values.map((value) => sanitizeHeaderValue(value)).join(", ");
}

function chunkText(value: string, size = 76) {
  const chunks: string[] = [];

  for (let index = 0; index < value.length; index += size) {
    chunks.push(value.slice(index, index + size));
  }

  return chunks.join("\r\n");
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function toBodyBase64(value: string) {
  return chunkText(Buffer.from(value, "utf8").toString("base64"));
}

function normalizeSendAsOption(
  raw: GmailSendAsApiRecord | Record<string, unknown>,
  fallbackEmail: string
): GmailSendAsOption | null {
  const email = normalizeText(raw.sendAsEmail) || fallbackEmail;
  if (!email) {
    return null;
  }

  return {
    email,
    displayName: normalizeText(raw.displayName) || null,
    isPrimary: raw.isPrimary === true,
    isDefault: raw.isDefault === true,
    replyToAddress: normalizeText(raw.replyToAddress) || null,
  };
}

function buildFallbackSendAsOption(accountName: string): GmailSendAsOption {
  return {
    email: accountName,
    displayName: null,
    isPrimary: true,
    isDefault: true,
    replyToAddress: null,
  };
}

function uniqueSendAsOptions(options: GmailSendAsOption[]) {
  const byEmail = new Map<string, GmailSendAsOption>();

  for (const option of options) {
    if (!option.email) {
      continue;
    }

    const key = option.email.toLowerCase();
    const existing = byEmail.get(key);

    if (!existing) {
      byEmail.set(key, option);
      continue;
    }

    byEmail.set(key, {
      email: existing.email,
      displayName: existing.displayName || option.displayName,
      isPrimary: existing.isPrimary || option.isPrimary,
      isDefault: existing.isDefault || option.isDefault,
      replyToAddress: existing.replyToAddress || option.replyToAddress,
    });
  }

  return Array.from(byEmail.values());
}

function sortSendAsOptions(options: GmailSendAsOption[]) {
  return [...options].sort((left, right) => {
    const leftRank = Number(left.isDefault) * 2 + Number(left.isPrimary);
    const rightRank = Number(right.isDefault) * 2 + Number(right.isPrimary);

    if (rightRank !== leftRank) {
      return rightRank - leftRank;
    }

    return left.email.localeCompare(right.email);
  });
}

export function getGmailComposeCapabilities(
  scopes: string[] | undefined | null
): GmailComposeCapabilities {
  const normalizedScopes = new Set(
    (scopes || []).map((scope) => normalizeText(scope)).filter(Boolean)
  );

  const hasFullMailScope = normalizedScopes.has("https://mail.google.com/");
  const hasModifyScope = normalizedScopes.has(
    "https://www.googleapis.com/auth/gmail.modify"
  );
  const hasComposeScope = normalizedScopes.has(
    "https://www.googleapis.com/auth/gmail.compose"
  );
  const hasSendScope = normalizedScopes.has(
    "https://www.googleapis.com/auth/gmail.send"
  );

  const canCreateDraft = hasFullMailScope || hasModifyScope || hasComposeScope;
  const canSend = canCreateDraft || hasSendScope;

  return {
    canCreateDraft,
    canSend,
  };
}

export async function loadGmailConnectionForUser(
  db: Firestore,
  userId: string
): Promise<GmailConnectionSuccess | GmailConnectionFailure> {
  const snapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "gmail")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false,
      errorCode: "GMAIL_NOT_CONNECTED",
      message: "Gmail is not connected for this workspace.",
    };
  }

  const doc = snapshot.docs[0];
  const integration = doc.data() as GmailIntegrationRecord;
  const refreshIv = integration.sync_cursor?.refresh_iv;

  if (
    !integration.access_token_enc ||
    !integration.token_iv ||
    !integration.refresh_token_enc ||
    !refreshIv
  ) {
    return {
      ok: false,
      errorCode: "GMAIL_AUTH_INCOMPLETE",
      message: "Gmail is connected, but the saved OAuth tokens are incomplete.",
    };
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());
  const validAccessToken = await ensureValidToken(db, doc.id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });

  return {
    ok: true,
    integrationId: doc.id,
    integration,
    config: {
      accessToken: validAccessToken,
      refreshToken,
      tokenExpiresAt,
    },
    accountName:
      integration.provider_account_name || integration.provider_account_id || "Gmail",
  };
}

export async function fetchGmailJson<T>(
  config: GmailConfig,
  path: string,
  init?: RequestInit
): Promise<GmailApiFailure | GmailApiSuccess<T>> {
  const response = await fetch(`${GMAIL_API_BASE}/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text();
    return {
      ok: false,
      status: response.status,
      message: text,
    };
  }

  return {
    ok: true,
    data: (await readGmailApiPayload(response)) as T,
  };
}

export async function loadGmailSendAsOptions(
  connection: GmailConnectionSuccess
) {
  const fallbackOption = buildFallbackSendAsOption(connection.accountName);
  const result = await fetchGmailJson<{ sendAs?: GmailSendAsApiRecord[] }>(
    connection.config,
    "settings/sendAs"
  );

  if (!result.ok) {
    return {
      options: [fallbackOption],
      warning:
        "Rearvy could not load Gmail aliases, so it will use the primary connected account.",
    };
  }

  const fallbackEmail = fallbackOption.email;
  const sendAsRecords = Array.isArray(result.data.sendAs)
    ? result.data.sendAs.filter(isRecord)
    : [];
  const normalizedOptions = uniqueSendAsOptions(
    sendAsRecords
      .map((entry) => normalizeSendAsOption(entry, fallbackEmail))
      .filter((entry): entry is GmailSendAsOption => Boolean(entry))
  );

  if (normalizedOptions.length === 0) {
    return {
      options: [fallbackOption],
      warning:
        "Rearvy could not find a send-from alias list, so it will use the primary connected account.",
    };
  }

  return {
    options: sortSendAsOptions(normalizedOptions),
    warning: null,
  };
}

export function pickDefaultSendAsOption(options: GmailSendAsOption[]) {
  return (
    options.find((option) => option.isDefault) ||
    options.find((option) => option.isPrimary) ||
    options[0]
  );
}

export function findSendAsOption(
  options: GmailSendAsOption[],
  email: string | null | undefined
) {
  if (!email) {
    return pickDefaultSendAsOption(options) || null;
  }

  const normalizedEmail = email.trim().toLowerCase();

  return (
    options.find((option) => option.email.toLowerCase() === normalizedEmail) ||
    null
  );
}

function buildRawMessage(
  payload: GmailComposePayload,
  from: GmailSendAsOption
) {
  const body = payload.body.replace(/\r?\n/g, "\r\n");
  const headers = [
    `From: ${formatMailbox(from)}`,
    `To: ${formatRecipients(payload.to)}`,
    ...(payload.cc.length > 0 ? [`Cc: ${formatRecipients(payload.cc)}`] : []),
    ...(payload.bcc.length > 0 ? [`Bcc: ${formatRecipients(payload.bcc)}`] : []),
    ...(from.replyToAddress
      ? [`Reply-To: ${sanitizeHeaderValue(from.replyToAddress)}`]
      : []),
    `Subject: ${encodeHeaderValue(payload.subject)}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
  ];

  return toBase64Url(`${headers.join("\r\n")}\r\n\r\n${toBodyBase64(body)}`);
}

export async function createGmailDraft(params: {
  config: GmailConfig;
  draft: GmailComposePayload;
  from: GmailSendAsOption;
}) {
  return fetchGmailJson<{
    id?: string;
    message?: {
      id?: string;
      threadId?: string;
      labelIds?: string[];
    };
  }>(params.config, "drafts", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: {
        raw: buildRawMessage(params.draft, params.from),
      },
    }),
  });
}

export async function sendGmailMessage(params: {
  config: GmailConfig;
  draft: GmailComposePayload;
  from: GmailSendAsOption;
}) {
  return fetchGmailJson<{
    id?: string;
    threadId?: string;
    labelIds?: string[];
  }>(params.config, "messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      raw: buildRawMessage(params.draft, params.from),
    }),
  });
}
