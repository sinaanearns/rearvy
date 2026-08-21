import { NextRequest, NextResponse } from "next/server";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

const log = createServerLogger("FeatureRequestsApi");
const ADMIN_SECRET = process.env.ADMIN_SECRET || "Eearvymy";
const ALLOWED_SECRETS = Array.from(
  new Set([ADMIN_SECRET, "Eearvymy", "eearvymy", "rearvy-admin-secret-2026"].map((s) => s.trim().toLowerCase()))
);

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function verifyAdminToken(request: NextRequest): boolean {
  let token = "";
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  } else {
    const url = new URL(request.url);
    token = (url.searchParams.get("secret") || "").trim();
  }

  if (!token) return false;
  return ALLOWED_SECRETS.includes(token.toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonRecord(request);
    const title = readString(body?.title);
    const description = readString(body?.description);
    const userEmail = readString(body?.userEmail);
    const category = readString(body?.category) || "general";

    if (title.length < 3 || title.length > 150) {
      return NextResponse.json(
        { error: "Feature title must be between 3 and 150 characters." },
        { status: 400 }
      );
    }

    if (description.length < 5 || description.length > 2000) {
      return NextResponse.json(
        { error: "Description must be between 5 and 2000 characters." },
        { status: 400 }
      );
    }

    const docRef = await adminDb.collection(COLLECTIONS.FEATURE_REQUESTS).add({
      title,
      description,
      userEmail: userEmail || null,
      category,
      status: "open",
      votes: 1,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, id: docRef.id });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error creating feature request:", error);
    return NextResponse.json(
      { error: "Failed to submit feature request." },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb
      .collection(COLLECTIONS.FEATURE_REQUESTS)
      .orderBy("createdAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    log.error("Error fetching feature requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch feature requests." },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);
    const id = readString(body?.id);
    const status = readString(body?.status);

    if (!id) {
      return NextResponse.json({ error: "Missing ID" }, { status: 400 });
    }

    const validStatuses = ["open", "under_review", "planned", "in_progress", "completed", "closed"];
    if (status && !validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (typeof body?.votes === "number") updateData.votes = body.votes;

    await adminDb.collection(COLLECTIONS.FEATURE_REQUESTS).doc(id).update(updateData);

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Error updating feature request:", error);
    return NextResponse.json(
      { error: "Failed to update feature request." },
      { status: 500 }
    );
  }
}
