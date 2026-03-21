import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";
import { parseListInput } from "@/lib/whispernet/core";

interface RouteParams {
  params: Promise<{ watcherId: string }>;
}

function normalizeArrayInput(value: unknown) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return parseListInput(value);
  }

  return undefined;
}

function nowIso() {
  return new Date().toISOString();
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { watcherId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watcherDoc = await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .doc(watcherId)
      .get();

    if (!watcherDoc.exists) {
      return NextResponse.json(
        { error: "Watcher not found." },
        { status: 404 }
      );
    }

    if (watcherDoc.data()?.user_id !== data.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const nextAliases = normalizeArrayInput(body?.aliases);
    const nextRequiredKeywords = normalizeArrayInput(body?.requiredKeywords);
    const nextExcludedPhrases = normalizeArrayInput(body?.excludedPhrases);

    const patch: Record<string, unknown> = {
      updated_at: nowIso(),
    };

    if (typeof body?.enabled === "boolean") {
      patch.enabled = body.enabled;
    }

    if (typeof body?.fuzzyMatch === "boolean") {
      patch.fuzzy_match = body.fuzzyMatch;
    }

    if (typeof body?.lowInventoryThreshold !== "undefined") {
      const threshold = Number(body.lowInventoryThreshold);
      patch.low_inventory_threshold = Number.isFinite(threshold)
        ? Math.max(0, threshold)
        : 10;
    }

    if (nextAliases) {
      patch.aliases = nextAliases;
    }

    if (nextRequiredKeywords) {
      patch.required_keywords = nextRequiredKeywords;
    }

    if (nextExcludedPhrases) {
      patch.excluded_phrases = nextExcludedPhrases;
    }

    await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .doc(watcherId)
      .set(patch, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update WhisperNet watcher:", error);
    return NextResponse.json(
      { error: "Failed to update watched product." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const { watcherId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const watcherDoc = await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .doc(watcherId)
      .get();

    if (!watcherDoc.exists) {
      return NextResponse.json(
        { error: "Watcher not found." },
        { status: 404 }
      );
    }

    if (watcherDoc.data()?.user_id !== data.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .doc(watcherId)
      .delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete WhisperNet watcher:", error);
    return NextResponse.json(
      { error: "Failed to delete watched product." },
      { status: 500 }
    );
  }
}
