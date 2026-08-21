import type { ProfileMemoryEntry } from "@/lib/profile-memory/types";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import {
  persistProfileMemory,
  mirrorProfileMemoryToFirestore,
  readProfileMemory,
} from "@/lib/profile-memory/store";
import { DESKTOP_PROBE_TARGETS } from "@/lib/profile-memory/desktop";
import { isRecord } from "@/lib/api/request-body";

const log = createServerLogger("DesktopProfileMemorySyncApi");

export const runtime = "nodejs";

function normalizeEntries(input: unknown) {
  if (!Array.isArray(input)) return [];
  return input
    .filter(isRecord)
    .map((entry) => {
      const slot = typeof entry.slot === "string" ? entry.slot.trim() : "";
      const value = typeof entry.value === "string" ? entry.value.trim() : "";
      const importance = typeof entry.importance === "number" ? entry.importance : 7;
      if (!slot || !value || !/^[a-z][a-z0-9_]{0,63}$/.test(slot)) return null;
      return {
        slot,
        value,
        source: "desktop_scan" as const,
        importance,
        tags: Array.isArray(entry.tags) ? entry.tags.map(String) : ["desktop-scan"],
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const snapshot = await readProfileMemory(adminDb, auth.user.uid);
    return NextResponse.json({ snapshot });
  } catch (error) {
    log.error("Failed to load desktop profile memory:", error);
    return NextResponse.json(
      { error: "Failed to load desktop profile memory." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const desktopHeader = request.headers.get("x-rearvy-desktop");
  const userAgent = (request.headers.get("user-agent") || "").toLowerCase();
  const isDesktopRequest =
    desktopHeader === "1" ||
    desktopHeader?.toLowerCase() === "true" ||
    userAgent.includes("electron");
  if (!isDesktopRequest) {
    return NextResponse.json(
      { error: "This endpoint only accepts requests from the Rearvy desktop app." },
      { status: 403 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const entries = normalizeEntries(body.entries);
  if (entries.length === 0) {
    return NextResponse.json(
      { error: "No valid desktop profile entries supplied." },
      { status: 400 }
    );
  }

  try {
    const persisted = await persistProfileMemory({
      adminDb,
      userId: auth.user.uid,
      entries,
      source: "desktop_scan",
    });
    const mirrored = await mirrorProfileMemoryToFirestore({
      adminDb,
      userId: auth.user.uid,
      projectId: typeof body.projectId === "string" ? body.projectId : null,
      snapshot: persisted.entries,
    });
    return NextResponse.json({
      snapshot: { entries: persisted.entries as unknown as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: "desktop_scan" },
      added: persisted.added,
      upgraded: persisted.upgraded,
      mirrored,
    });
  } catch (error) {
    log.error("Failed to persist desktop profile memory:", error);
    return NextResponse.json(
      { error: "Failed to persist desktop profile memory." },
      { status: 500 }
    );
  }
}
