import { NextResponse, type NextRequest } from "next/server";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const VOICE_AGENT_TOKEN_URL = "https://agents.assemblyai.com/v1/token";
const DEFAULT_VOICE_AGENT_TOKEN_SECONDS = 300;
const DEFAULT_VOICE_AGENT_MAX_SESSION_SECONDS = 900;

const log = createServerLogger("VoiceAgentToken");

function pickString(value: unknown, fallback = ""): string {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampInteger(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

export async function GET(request: NextRequest) {
  const requestId = pickString(request.nextUrl.searchParams.get("requestId"), "voice-agent-token");
  const expiresInSeconds = clampInteger(
    process.env.ASSEMBLYAI_VOICE_AGENT_TOKEN_SECONDS,
    DEFAULT_VOICE_AGENT_TOKEN_SECONDS,
    1,
    600
  );
  const maxSessionDurationSeconds = clampInteger(
    process.env.ASSEMBLYAI_VOICE_AGENT_MAX_SESSION_SECONDS,
    DEFAULT_VOICE_AGENT_MAX_SESSION_SECONDS,
    60,
    10800
  );

  const apiKey = process.env.ASSEMBLYAI_API_KEY;
  if (!apiKey) {
    log.warn("voice agent token unavailable: missing AssemblyAI key", {
      requestId,
      expiresInSeconds,
      maxSessionDurationSeconds,
    });
    return NextResponse.json(
      {
        ok: false,
        error: "AssemblyAI API key not configured on server",
        code: "assemblyai_key_missing",
        requestId,
      },
      { status: 501 }
    );
  }

  try {
    const url = new URL(VOICE_AGENT_TOKEN_URL);
    url.searchParams.set("expires_in_seconds", String(expiresInSeconds));
    url.searchParams.set("max_session_duration_seconds", String(maxSessionDurationSeconds));

    log.debug("minting AssemblyAI voice agent token", {
      requestId,
      expiresInSeconds,
      maxSessionDurationSeconds,
    });

    // Try with raw API key first, then with Bearer prefix for compatibility
    let response = await fetch(url, {
      headers: {
        authorization: apiKey,
      },
    });

    // Retry with Bearer auth if 401
    if (response.status === 401 || response.status === 403) {
      response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
    }

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      log.warn("voice agent token request failed", {
        requestId,
        status: response.status,
        detail: payload,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "AssemblyAI Voice Agent token request failed",
          code: "assemblyai_voice_agent_token_failed",
          status: response.status,
          detail: payload,
          requestId,
        },
        { status: 502 }
      );
    }

    const token = pickString(payload?.token || payload?.temporary_token || payload?.temporaryToken);
    if (!token) {
      log.warn("voice agent token response did not include a token", {
        requestId,
        status: response.status,
        detail: payload,
      });
      return NextResponse.json(
        {
          ok: false,
          error: "AssemblyAI Voice Agent token response was invalid",
          code: "assemblyai_voice_agent_token_missing",
          status: response.status,
          detail: payload,
          requestId,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      token,
      expiresInSeconds,
      maxSessionDurationSeconds,
      requestId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.warn("voice agent token network error", {
      requestId,
      detail: message.slice(0, 500),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "AssemblyAI Voice Agent token request failed",
        code: "assemblyai_network_error",
        detail: message.slice(0, 500),
        requestId,
      },
      { status: 502 }
    );
  }
}