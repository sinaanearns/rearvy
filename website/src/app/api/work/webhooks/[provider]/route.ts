import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { enqueueAgentEvent } from "@/lib/agent-events/store";
import { COLLECTIONS, type WorkChannelProvider } from "@/lib/firebase/schema";
import {
  getChannelAdapter,
  getProviderEnvCredentials,
  hasProviderWebhookVerification,
  persistInboundChannelMessages,
  resolveInboundChannelUserId,
  resolveWebhookVerification,
} from "@/lib/work/channels";

export const runtime = "nodejs";

const PROVIDERS: WorkChannelProvider[] = [
  "telegram",
  "discord",
  "slack",
  "whatsapp",
  "wechat",
  "dingtalk",
  "lark",
];

function providerFromString(value: string): WorkChannelProvider | null {
  return PROVIDERS.includes(value as WorkChannelProvider)
    ? (value as WorkChannelProvider)
    : null;
}

function parseJson(raw: string) {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

async function resolveUserForInbound(provider: WorkChannelProvider, channelId: string | null) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.WORK_CHANNEL_CONNECTIONS)
    .where("provider", "==", provider)
    .get();
  const connections = snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as {
      id: string;
      user_id?: string;
      status?: string;
      external_channel_id?: string | null;
    });
  return resolveInboundChannelUserId(connections, channelId);
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerFromString(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unsupported webhook provider." }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (provider === "whatsapp") {
    const credentials = getProviderEnvCredentials("whatsapp");
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge") || "";
    if (mode === "subscribe" && token && token === credentials.verifyToken) {
      return new NextResponse(challenge, { status: 200 });
    }
    return NextResponse.json({ error: "Unauthorized webhook verification." }, { status: 401 });
  }

  return NextResponse.json({ ok: true, provider });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider: providerParam } = await params;
  const provider = providerFromString(providerParam);
  if (!provider) {
    return NextResponse.json({ error: "Unsupported webhook provider." }, { status: 404 });
  }

  const raw = await request.text();
  const payload = parseJson(raw);
  const adapter = getChannelAdapter(provider);
  const credentials = getProviderEnvCredentials(provider);
  if (!hasProviderWebhookVerification(provider, credentials)) {
    return NextResponse.json(
      { error: "Webhook verification is not configured for this provider." },
      { status: 503 }
    );
  }

  const verified = resolveWebhookVerification(provider, raw, request.headers, credentials, payload);
  if (!verified) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  if (provider === "slack" && typeof payload.challenge === "string") {
    return NextResponse.json({ challenge: payload.challenge });
  }
  if (provider === "discord" && payload.type === 1) {
    return NextResponse.json({ type: 1 });
  }
  if (provider === "lark" && typeof payload.challenge === "string") {
    return NextResponse.json({ challenge: payload.challenge });
  }

  const normalized = adapter.normalizeInbound(payload, request.headers);
  const channelId = normalized.find((message) => message.externalChannelId)?.externalChannelId || null;
  const userId = await resolveUserForInbound(provider, channelId);
  if (!userId) {
    return NextResponse.json({
      ok: true,
      stored: 0,
      note: "No Rearvy channel connection matched this webhook.",
    });
  }

  const messages = await persistInboundChannelMessages(adminDb, userId, provider, normalized);
  for (const message of messages) {
    const event = await enqueueAgentEvent(adminDb, {
      userId,
      type: "webhook",
      source: "webhook",
      payload: {
        provider,
        channelMessageId: message.id,
        text: message.text,
        externalChannelId: message.external_channel_id,
      },
      dedupeKey: `channel:${provider}:${message.external_message_id || message.id}`,
      priority: 5,
      maxAttempts: 3,
    });
    await adminDb.collection(COLLECTIONS.WORK_CHANNEL_MESSAGES).doc(message.id).set(
      {
        agent_event_id: event.eventId,
        updated_at: new Date().toISOString(),
      },
      { merge: true }
    );
  }

  return NextResponse.json({ ok: true, stored: messages.length });
}
