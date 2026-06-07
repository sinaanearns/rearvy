import { tool } from "ai";
import { z } from "zod";
import type { ToolContext } from "../types";
import {
  COLLECTIONS,
  type GmailMessage,
  type Integration,
} from "@/lib/firebase/schema";
import {
  ensureValidToken,
  type GmailConfig,
} from "@/lib/integrations/gmail/client";
import { decrypt } from "@/lib/utils/encryption";
import {
  gmailComposeToolInputSchema,
  type GmailComposeToolResult,
} from "@/lib/integrations/gmail/compose-shared";
import {
  getGmailComposeCapabilities,
  loadGmailConnectionForUser,
  loadGmailSendAsOptions,
  pickDefaultSendAsOption,
} from "@/lib/integrations/gmail/server";

const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_BODY_PREVIEW_CHARS = 600;

type GmailIntegrationRecord = Integration & {
  sync_cursor?: {
    refresh_iv?: string;
  };
};

type ParsedSender = {
  raw: string;
  email: string | null;
  name: string | null;
  display: string;
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

type AnyGmailApiResult = GmailApiFailure | GmailApiSuccess<unknown>;

async function readGmailApiPayload(response: Response) {
  try {
    return {
      ok: true as const,
      data: (await response.json()) as unknown,
    };
  } catch {
    return {
      ok: false as const,
      message: "Gmail returned a malformed JSON response.",
    };
  }
}

function normalizeText(value: string | null | undefined) {
  return (value || "").replace(/\s+/g, " ").trim();
}

function truncateText(value: string | null | undefined, maxChars = 220) {
  const text = normalizeText(value);
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars - 1)}…` : text;
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return null;

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString();
}

function toTimestamp(value: Date | string | null | undefined) {
  if (!value) return 0;
  const parsed =
    value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseSender(rawFrom: string | null | undefined): ParsedSender {
  const raw = normalizeText(rawFrom);
  const bracketMatch = raw.match(/<([^>]+)>/);
  const fallbackEmailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const email = bracketMatch?.[1] || fallbackEmailMatch?.[0] || null;
  const name = normalizeText(raw.replace(/<[^>]+>/g, "").replace(/^"|"$/g, ""));

  return {
    raw,
    email,
    name: name || null,
    display: name || email || raw || "Unknown sender",
  };
}

function buildBodyPreview(message: GmailMessage) {
  const body = truncateText(message.body_text, MAX_BODY_PREVIEW_CHARS);
  if (body) return body;
  return truncateText(message.snippet, 280);
}

function summarizeMessage(message: GmailMessage) {
  const sender = parseSender(message.from);

  return {
    messageId: message.id,
    threadId: message.thread_id,
    from: {
      raw: message.from,
      name: sender.name,
      email: sender.email,
      display: sender.display,
    },
    to: message.to,
    subject: message.subject || "(no subject)",
    snippet: truncateText(message.snippet, 280),
    bodyPreview: buildBodyPreview(message),
    category: message.category,
    sentiment: message.sentiment,
    intentSignals: message.intent_signals,
    receivedAt: toIsoString(message.received_at),
  };
}

async function loadGmailMessages(ctx: ToolContext) {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.GMAIL_MESSAGES)
    .where("user_id", "==", ctx.userId)
    .get();

  return snapshot.docs
    .map((doc) => doc.data() as GmailMessage)
    .sort((a, b) => toTimestamp(b.received_at) - toTimestamp(a.received_at));
}

async function loadGmailConnection(ctx: ToolContext) {
  const snapshot = await ctx.adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", ctx.userId)
    .where("provider", "==", "gmail")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false as const,
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
      ok: false as const,
      errorCode: "GMAIL_AUTH_INCOMPLETE",
      message: "Gmail is connected, but the saved OAuth tokens are incomplete.",
    };
  }

  const accessToken = decrypt(integration.access_token_enc, integration.token_iv);
  const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
  const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());
  const validAccessToken = await ensureValidToken(ctx.adminDb, doc.id, {
    accessToken,
    refreshToken,
    tokenExpiresAt,
  });

  return {
    ok: true as const,
    integrationId: doc.id,
    integration,
    config: {
      accessToken: validAccessToken,
      refreshToken,
      tokenExpiresAt,
    } satisfies GmailConfig,
    accountName:
      integration.provider_account_name || integration.provider_account_id || "Gmail",
  };
}

async function fetchGmailJson<T>(
  config: GmailConfig,
  path: string
): Promise<GmailApiFailure | GmailApiSuccess<T>> {
  const response = await fetch(`${GMAIL_API_BASE}/${path}`, {
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    return {
      ok: false,
      status: response.status,
      message: text || `Gmail request failed with HTTP ${response.status}.`,
    };
  }

  const payload = await readGmailApiPayload(response);
  if (!payload.ok) {
    return {
      ok: false,
      status: response.status,
      message: payload.message,
    };
  }

  return {
    ok: true,
    data: payload.data as T,
  };
}

function countBy<T extends string>(
  values: Array<T | null | undefined>,
  fallbackLabel = "unknown"
) {
  return values.reduce<Record<string, number>>((acc, value) => {
    const key = value || fallbackLabel;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function toSenderLeaderboard(messages: GmailMessage[], limit = 5) {
  const senderCounts = new Map<
    string,
    { sender: ParsedSender; count: number; latestAt: number }
  >();

  for (const message of messages) {
    const sender = parseSender(message.from);
    const key = sender.email || sender.raw || "unknown";
    const current = senderCounts.get(key);
    const receivedAt = toTimestamp(message.received_at);

    if (!current) {
      senderCounts.set(key, { sender, count: 1, latestAt: receivedAt });
      continue;
    }

    current.count += 1;
    current.latestAt = Math.max(current.latestAt, receivedAt);
  }

  return Array.from(senderCounts.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return b.latestAt - a.latestAt;
    })
    .slice(0, limit)
    .map((entry) => ({
      sender: entry.sender.display,
      email: entry.sender.email,
      count: entry.count,
      latestAt: new Date(entry.latestAt).toISOString(),
    }));
}

export function getGmailInboxSummary(ctx: ToolContext) {
  return tool({
    description:
      "Summarize synced Gmail inbox activity, top senders, support themes, and recent email patterns.",
    inputSchema: z.object({
      days: z.number().int().min(1).max(365).optional().default(14),
    }),
    execute: async ({ days }) => {
      const connection = await loadGmailConnection(ctx);
      if (!connection.ok) {
        return {
          ok: false,
          errorCode: connection.errorCode,
          message: connection.message,
        };
      }

      const allMessages = await loadGmailMessages(ctx);
      if (allMessages.length === 0) {
        return {
          ok: false,
          errorCode: "GMAIL_NO_MESSAGES",
          message:
            "Gmail is connected, but no synced email messages were found yet.",
          accountName: connection.accountName,
        };
      }

      const periodStart = Date.now() - days * 24 * 60 * 60 * 1000;
      const periodMessages = allMessages.filter(
        (message) => toTimestamp(message.received_at) >= periodStart
      );

      const relevantMessages =
        periodMessages.length > 0 ? periodMessages : allMessages.slice(0, 25);

      return {
        ok: true,
        accountName: connection.accountName,
        syncedMessageCount: allMessages.length,
        periodDays: days,
        messagesInPeriod: periodMessages.length,
        threadCount: new Set(relevantMessages.map((message) => message.thread_id)).size,
        uniqueSenders: new Set(
          relevantMessages
            .map((message) => parseSender(message.from).email || message.from)
            .filter(Boolean)
        ).size,
        categoryBreakdown: countBy(
          relevantMessages.map((message) => message.category),
          "unclassified"
        ),
        sentimentBreakdown: countBy(
          relevantMessages.map((message) => message.sentiment),
          "unclassified"
        ),
        topSenders: toSenderLeaderboard(relevantMessages),
        recentMessages: relevantMessages.slice(0, 5).map(summarizeMessage),
        message:
          periodMessages.length > 0
            ? `Loaded Gmail inbox activity for the last ${days} days.`
            : `No emails were found in the last ${days} days, so this summary uses the most recent synced emails instead.`,
      };
    },
  });
}

export function getRecentGmailMessages(ctx: ToolContext) {
  return tool({
    description:
      "Read recent synced Gmail messages with sender info, subject lines, and content previews.",
    inputSchema: z.object({
      limit: z.number().int().min(1).max(25).optional().default(8),
      days: z.number().int().min(1).max(365).optional().default(30),
      sender: z.string().optional(),
      category: z
        .enum(["pre_sale", "support", "order_update", "complaint", "other"])
        .optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
    }),
    execute: async ({ limit, days, sender, category, sentiment }) => {
      const connection = await loadGmailConnection(ctx);
      if (!connection.ok) {
        return {
          ok: false,
          errorCode: connection.errorCode,
          message: connection.message,
        };
      }

      const senderNeedle = normalizeText(sender).toLowerCase();
      const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
      const messages = (await loadGmailMessages(ctx)).filter((message) => {
        if (toTimestamp(message.received_at) < cutoff) return false;

        if (category && message.category !== category) return false;
        if (sentiment && message.sentiment !== sentiment) return false;

        if (!senderNeedle) return true;

        const parsed = parseSender(message.from);
        return [parsed.raw, parsed.name || "", parsed.email || ""]
          .join(" ")
          .toLowerCase()
          .includes(senderNeedle);
      });

      const results = messages.slice(0, limit);

      return {
        ok: true,
        accountName: connection.accountName,
        totalMatches: messages.length,
        filters: {
          days,
          sender: sender || null,
          category: category || null,
          sentiment: sentiment || null,
        },
        messages: results.map(summarizeMessage),
        message:
          results.length > 0
            ? `Loaded ${results.length} recent Gmail messages.`
            : "No Gmail messages matched those recent-message filters.",
      };
    },
  });
}

export function searchGmailMessages(ctx: ToolContext) {
  return tool({
    description:
      "Search synced Gmail messages by sender, subject, content, sentiment, category, or thread to show specific email details.",
    inputSchema: z.object({
      query: z.string().optional(),
      sender: z.string().optional(),
      subject: z.string().optional(),
      threadId: z.string().optional(),
      category: z
        .enum(["pre_sale", "support", "order_update", "complaint", "other"])
        .optional(),
      sentiment: z.enum(["positive", "neutral", "negative"]).optional(),
      limit: z.number().int().min(1).max(25).optional().default(10),
    }),
    execute: async ({
      query,
      sender,
      subject,
      threadId,
      category,
      sentiment,
      limit,
    }) => {
      const connection = await loadGmailConnection(ctx);
      if (!connection.ok) {
        return {
          ok: false,
          errorCode: connection.errorCode,
          message: connection.message,
        };
      }

      const queryNeedle = normalizeText(query).toLowerCase();
      const senderNeedle = normalizeText(sender).toLowerCase();
      const subjectNeedle = normalizeText(subject).toLowerCase();
      const normalizedThreadId = normalizeText(threadId);
      const allMessages = await loadGmailMessages(ctx);

      const matches = allMessages.filter((message) => {
        if (normalizedThreadId && message.thread_id !== normalizedThreadId) {
          return false;
        }

        if (category && message.category !== category) return false;
        if (sentiment && message.sentiment !== sentiment) return false;

        const parsedSender = parseSender(message.from);
        const senderHaystack = [parsedSender.raw, parsedSender.name, parsedSender.email]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (senderNeedle && !senderHaystack.includes(senderNeedle)) {
          return false;
        }

        const normalizedSubject = normalizeText(message.subject).toLowerCase();
        if (subjectNeedle && !normalizedSubject.includes(subjectNeedle)) {
          return false;
        }

        if (!queryNeedle) return true;

        const haystack = [
          senderHaystack,
          normalizedSubject,
          normalizeText(message.snippet).toLowerCase(),
          normalizeText(message.body_text).toLowerCase(),
          message.to.join(" ").toLowerCase(),
        ].join(" ");

        return haystack.includes(queryNeedle);
      });

      const results = matches.slice(0, limit);

      return {
        ok: true,
        accountName: connection.accountName,
        totalMatches: matches.length,
        filters: {
          query: query || null,
          sender: sender || null,
          subject: subject || null,
          threadId: normalizedThreadId || null,
          category: category || null,
          sentiment: sentiment || null,
        },
        messages: results.map(summarizeMessage),
        message:
          results.length > 0
            ? `Found ${matches.length} Gmail messages that matched the search.`
            : "No Gmail messages matched that search.",
      };
    },
  });
}

export function getGmailSettings(ctx: ToolContext) {
  return tool({
    description:
      "Read Gmail mailbox settings such as language, IMAP, POP, vacation responder, aliases, forwarding, and optional filters.",
    inputSchema: z.object({
      includeFilters: z.boolean().optional().default(false),
      includeAliases: z.boolean().optional().default(true),
    }),
    execute: async ({ includeFilters, includeAliases }) => {
      const connection = await loadGmailConnection(ctx);
      if (!connection.ok) {
        return {
          ok: false,
          errorCode: connection.errorCode,
          message: connection.message,
        };
      }

      const requests = await Promise.all([
        fetchGmailJson<Record<string, unknown>>(connection.config, "settings/language"),
        fetchGmailJson<Record<string, unknown>>(connection.config, "settings/imap"),
        fetchGmailJson<Record<string, unknown>>(connection.config, "settings/pop"),
        fetchGmailJson<Record<string, unknown>>(connection.config, "settings/vacation"),
        fetchGmailJson<Record<string, unknown>>(
          connection.config,
          "settings/autoForwarding"
        ),
        fetchGmailJson<{ forwardingAddresses?: Array<Record<string, unknown>> }>(
          connection.config,
          "settings/forwardingAddresses"
        ),
        includeAliases
          ? fetchGmailJson<{ sendAs?: Array<Record<string, unknown>> }>(
              connection.config,
              "settings/sendAs"
            )
          : Promise.resolve({
              ok: true as const,
              data: { sendAs: [] as Array<Record<string, unknown>> },
            }),
        includeFilters
          ? fetchGmailJson<{ filter?: Array<Record<string, unknown>> }>(
              connection.config,
              "settings/filters"
            )
          : Promise.resolve({
              ok: true as const,
              data: { filter: [] as Array<Record<string, unknown>> },
            }),
      ]);

      const [
        language,
        imap,
        pop,
        vacation,
        autoForwarding,
        forwardingAddresses,
        sendAs,
        filters,
      ] = requests;

      const unavailable = [
        { setting: "language", result: language as AnyGmailApiResult },
        { setting: "imap", result: imap as AnyGmailApiResult },
        { setting: "pop", result: pop as AnyGmailApiResult },
        { setting: "vacation", result: vacation as AnyGmailApiResult },
        {
          setting: "autoForwarding",
          result: autoForwarding as AnyGmailApiResult,
        },
        {
          setting: "forwardingAddresses",
          result: forwardingAddresses as AnyGmailApiResult,
        },
        { setting: "sendAs", result: sendAs as AnyGmailApiResult },
        { setting: "filters", result: filters as AnyGmailApiResult },
      ]
        .filter((entry) => !entry.result.ok)
        .map((entry) => ({
          setting: entry.setting,
          status: (entry.result as GmailApiFailure).status,
          message: truncateText((entry.result as GmailApiFailure).message, 180),
        }));

      return {
        ok: true,
        accountName: connection.accountName,
        settings: {
          language: language.ok ? language.data : null,
          imap: imap.ok ? imap.data : null,
          pop: pop.ok ? pop.data : null,
          vacation: vacation.ok ? vacation.data : null,
          autoForwarding: autoForwarding.ok ? autoForwarding.data : null,
          forwardingAddresses: forwardingAddresses.ok
            ? forwardingAddresses.data.forwardingAddresses || []
            : [],
          sendAs: sendAs.ok ? sendAs.data.sendAs || [] : [],
          filters: filters.ok ? filters.data.filter || [] : [],
        },
        counts: {
          forwardingAddresses:
            forwardingAddresses.ok
              ? (forwardingAddresses.data.forwardingAddresses || []).length
              : 0,
          aliases: sendAs.ok ? (sendAs.data.sendAs || []).length : 0,
          filters: filters.ok ? (filters.data.filter || []).length : 0,
        },
        unavailable,
        message:
          unavailable.length === 0
            ? "Loaded Gmail settings successfully."
            : "Loaded Gmail settings, but some endpoints were unavailable.",
      };
    },
  });
}

function combineWarnings(...values: Array<string | null>) {
  return values.filter(Boolean).join(" ") || null;
}

export function prepareGmailMessage(ctx: ToolContext) {
  return tool({
    description:
      "Prepare a Gmail review card with the sending account, recipients, subject, and body when the user wants to draft or send an email. Ask one short follow-up first if the recipient email address is missing or ambiguous. Set sendNowPreferred to true only when the user clearly wants the email sent after review.",
    inputSchema: gmailComposeToolInputSchema,
    execute: async ({
      sendNowPreferred,
      ...draft
    }): Promise<GmailComposeToolResult> => {
      const connection = await loadGmailConnectionForUser(ctx.adminDb, ctx.userId);
      if (!connection.ok) {
        return {
          kind: "gmail-compose-review",
          ok: false,
          errorCode: connection.errorCode,
          message: connection.message,
          reconnectRequired: true,
        };
      }

      const { options, warning: sendAsWarning } =
        await loadGmailSendAsOptions(connection);
      const selectedFrom = pickDefaultSendAsOption(options);

      if (!selectedFrom) {
        return {
          kind: "gmail-compose-review",
          ok: false,
          errorCode: "GMAIL_SEND_FROM_UNAVAILABLE",
          message:
            "Rearvy could not determine which Gmail address should send this message.",
          reconnectRequired: false,
        };
      }

      const capabilities = getGmailComposeCapabilities(
        connection.integration.scopes
      );
      const reconnectRequired =
        !capabilities.canCreateDraft && !capabilities.canSend;
      const permissionWarning = reconnectRequired
        ? "Reconnect Gmail to grant compose access before Rearvy can create a Gmail draft or send this message."
        : null;

      const defaultAction =
        sendNowPreferred && capabilities.canSend
          ? "send"
          : capabilities.canCreateDraft
            ? "draft"
            : capabilities.canSend
              ? "send"
              : "draft";

      return {
        kind: "gmail-compose-review",
        ok: true,
        message:
          "Prepared a Gmail message for review. Confirm the sender, recipient, subject, and body before saving the draft or sending it.",
        accountName: connection.accountName,
        selectedFrom,
        availableFrom: options,
        draft,
        defaultAction,
        capabilities,
        reconnectRequired,
        warning: combineWarnings(permissionWarning, sendAsWarning),
      };
    },
  });
}
