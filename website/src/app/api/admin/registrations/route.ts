import { NextRequest, NextResponse } from "next/server";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

const log = createServerLogger("AdminRegistrationsApi");
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

export async function GET(request: NextRequest) {
  try {
    if (!verifyAdminToken(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const snapshot = await adminDb
      .collection(COLLECTIONS.BUSINESS_REGISTRATIONS)
      .orderBy("submittedAt", "desc")
      .get();

    const items = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    log.error("Error fetching business registrations:", error);
    return NextResponse.json(
      { error: "Failed to fetch business registrations." },
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

    const validStatuses = ["new", "reviewed", "contacted", "approved", "rejected"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    await adminDb.collection(COLLECTIONS.BUSINESS_REGISTRATIONS).doc(id).update({
      status,
      reviewedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error updating business registration:", error);
    return NextResponse.json(
      { error: "Failed to update business registration." },
      { status: 500 }
    );
  }
}
