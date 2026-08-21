import type { ProfileMemoryEntry } from "@/lib/profile-memory/types";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import {
  readProfileMemory,
  persistProfileMemory,
  mirrorProfileMemoryToFirestore,
} from "@/lib/profile-memory/store";
import { extractProfileMemoryEntries } from "@/lib/profile-memory/extractor";
import { redactSensitiveMemoryText } from "@/lib/sensitive-memory";
import { isRecord } from "@/lib/api/request-body";

const log = createServerLogger("ProfileMemoryApi");

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const snapshot = await readProfileMemory(adminDb, auth.user.uid);
    return NextResponse.json({ snapshot });
  } catch (error) {
    log.error("Failed to load profile memory:", error);
    return NextResponse.json(
      { error: "Failed to load profile memory." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  if (!isRecord(body)) {
    return NextResponse.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const userText = typeof body.userText === "string" ? body.userText.trim() : "";
  const projectId = typeof body.projectId === "string" ? body.projectId : null;
  const entriesFromText = userText
    ? extractProfileMemoryEntries(redactSensitiveMemoryText(userText))
    : [];
  const incomingEntries = Array.isArray(body.entries) ? body.entries : [];
  const merged = [
    ...entriesFromText,
    ...incomingEntries.filter(isRecord).map((entry) => ({
      slot: (typeof entry.slot === "string" ? entry.slot : "other_software") as ProfileMemoryEntry["slot"],
      value: redactSensitiveMemoryText(String(entry.value ?? "")),
      source: (entry.source === "desktop_scan" || entry.source === "profile_form"
        ? entry.source
        : "user_statement") as ProfileMemoryEntry["source"],
      importance: typeof entry.importance === "number" ? entry.importance : 7,
      tags: Array.isArray(entry.tags)
        ? entry.tags.filter((tag): tag is string => typeof tag === "string")
        : [],
    })),
  ].filter((entry) => entry.value && entry.value.length > 0);

  if (merged.length === 0) {
    return NextResponse.json(
      { error: "Provide a userText or entries payload to update profile memory." },
      { status: 400 }
    );
  }

  try {
    const persisted = await persistProfileMemory({
      adminDb,
      userId: auth.user.uid,
      entries: merged,
      source: "user_statement",
    });
    const mirrored = await mirrorProfileMemoryToFirestore({
      adminDb,
      userId: auth.user.uid,
      projectId,
      snapshot: persisted.entries,
    });
    return NextResponse.json({
      snapshot: { entries: persisted.entries as unknown as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: "merge" },
      added: persisted.added,
      upgraded: persisted.upgraded,
      mirrored,
    });
  } catch (error) {
    log.error("Failed to update profile memory:", error);
    return NextResponse.json(
      { error: "Failed to update profile memory." },
      { status: 500 }
    );
  }
}
