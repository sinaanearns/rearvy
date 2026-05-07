import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";
import { parseListInput } from "@/lib/whispernet/core";
import type { Product, WhisperNetWatcher } from "@/types/database";

function nowIso() {
  return new Date().toISOString();
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

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [watchersSnapshot, productsSnapshot] = await Promise.all([
      adminDb
        .collection(COLLECTIONS.WHISPERNET_WATCHERS)
        .where("user_id", "==", data.user.id)
        .get(),
      adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .where("user_id", "==", data.user.id)
        .get(),
    ]);

    const watchers = watchersSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));
    const products = productsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ watchers, products });
  } catch (error) {
    console.error("Failed to fetch WhisperNet watchers:", error);
    return NextResponse.json(
      { error: "Failed to fetch WhisperNet watchers." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const productId =
      typeof body?.productId === "string" ? body.productId.trim() : "";
    const fuzzyMatch = body?.fuzzyMatch !== false;
    const lowInventoryThreshold = Math.max(
      0,
      Number(body?.lowInventoryThreshold ?? 10)
    );

    if (!productId) {
      return NextResponse.json(
        { error: "A Shopify product is required." },
        { status: 400 }
      );
    }

    const productDoc = await adminDb
      .collection(COLLECTIONS.PRODUCTS)
      .doc(productId)
      .get();

    if (!productDoc.exists) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const product = {
      id: productDoc.id,
      ...productDoc.data(),
    } as Product;

    if (product.user_id !== data.user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const aliases = normalizeArrayInput(body?.aliases);
    const requiredKeywords = normalizeArrayInput(body?.requiredKeywords);
    const excludedPhrases = normalizeArrayInput(body?.excludedPhrases);

    const existingWatchersSnapshot = await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .where("user_id", "==", data.user.id)
      .get();

    const existingWatcher = existingWatchersSnapshot.docs.find(
      (doc) => doc.data().product_id === productId
    );

    const watcherId = existingWatcher?.id || adminDb.collection(COLLECTIONS.WHISPERNET_WATCHERS).doc().id;
    const timestamp = nowIso();
    const payload = {
      id: watcherId,
      user_id: data.user.id,
      product_id: product.id,
      product_title: product.title,
      product_handle: product.handle || null,
      aliases,
      required_keywords: requiredKeywords,
      excluded_phrases: excludedPhrases,
      fuzzy_match: fuzzyMatch,
      enabled: true,
      low_inventory_threshold: Number.isFinite(lowInventoryThreshold)
        ? lowInventoryThreshold
        : 10,
      updated_at: timestamp,
      ...(existingWatcher ? {} : { created_at: timestamp }),
    } satisfies Partial<WhisperNetWatcher>;

    await adminDb
      .collection(COLLECTIONS.WHISPERNET_WATCHERS)
      .doc(watcherId)
      .set(payload, { merge: true });

    return NextResponse.json({ success: true, id: watcherId });
  } catch (error) {
    console.error("Failed to create WhisperNet watcher:", error);
    return NextResponse.json(
      { error: "Failed to save watched product." },
      { status: 500 }
    );
  }
}
