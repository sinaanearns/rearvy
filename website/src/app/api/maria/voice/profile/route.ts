import { NextResponse, type NextRequest } from "next/server";
import { isRecord, isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { getVoiceContext, getVoiceProfile, updateVoiceProfile } from "@/lib/maria/voice-store";
import type { MariaVoiceProfile } from "@/lib/maria/voice-core";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("MariaVoiceProfileRoute");

function readString(value: unknown, fallback = "", maxLength = 500) {
  return typeof value === "string" && value.trim()
    ? value.trim().slice(0, maxLength)
    : fallback;
}

function sanitizeProfilePatch(body: Record<string, unknown>): Partial<MariaVoiceProfile> {
  const patch: Partial<MariaVoiceProfile> = {};

  if (typeof body.shortcut === "string") {
    patch.shortcut = readString(body.shortcut, "Ctrl+Alt+Space", 80);
  }
  if (typeof body.commandShortcut === "string") {
    patch.commandShortcut = readString(body.commandShortcut, "Ctrl+Alt+Shift+Space", 80);
  }
  if (typeof body.commandModeEnabled === "boolean") {
    patch.commandModeEnabled = body.commandModeEnabled;
  }
  if (typeof body.contextAwarenessEnabled === "boolean") {
    patch.contextAwarenessEnabled = body.contextAwarenessEnabled;
  }
  if (typeof body.pressEnterEnabled === "boolean") {
    patch.pressEnterEnabled = body.pressEnterEnabled;
  }
  if (body.languageMode === "english" || body.languageMode === "multilingual" || body.languageMode === "auto") {
    patch.languageMode = body.languageMode;
  }
  if (body.retentionMode === "metadata" || body.retentionMode === "transcripts" || body.retentionMode === "off") {
    patch.retentionMode = body.retentionMode;
  }
  if (typeof body.usageAnalyticsVisible === "boolean") {
    patch.usageAnalyticsVisible = body.usageAnalyticsVisible;
  }
  if (isRecord(body.styleDefaults)) {
    patch.styleDefaults = body.styleDefaults as MariaVoiceProfile["styleDefaults"];
  }

  return patch;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const includeContext = request.nextUrl.searchParams.get("includeContext") === "1";
    if (includeContext) {
      const context = await getVoiceContext(adminDb, auth.user.uid);
      return NextResponse.json({ ok: true, ...context });
    }

    const profile = await getVoiceProfile(adminDb, auth.user.uid);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    log.error("Failed to load Maria voice profile:", error);
    return NextResponse.json({ error: "Failed to load Maria voice profile." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    const patch = sanitizeProfilePatch(body);
    const profile = await updateVoiceProfile(adminDb, auth.user.uid, patch);
    return NextResponse.json({ ok: true, profile });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to update Maria voice profile:", error);
    return NextResponse.json({ error: "Failed to update Maria voice profile." }, { status: 500 });
  }
}
