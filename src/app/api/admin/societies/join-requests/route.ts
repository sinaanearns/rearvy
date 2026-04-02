import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isAdminAuthenticated } from "@/lib/admin-auth";

const ALLOWED_STATUSES = new Set(["submitted", "reviewing", "approved", "rejected", "all"]);

function toIso(value: unknown): string {
  if (!value) {
    return new Date().toISOString();
  }

  if (typeof value === "object" && value && "toDate" in value) {
    const millis = (value as { toDate: () => Date }).toDate().getTime();
    return new Date(millis).toISOString();
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  if (typeof value === "number") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return new Date().toISOString();
}

export async function GET(request: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const rawStatus = (searchParams.get("status") || "submitted").toLowerCase();
    const status = ALLOWED_STATUSES.has(rawStatus) ? rawStatus : "submitted";
    const rawLimit = Number(searchParams.get("limit") || "100");
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 200)
      : 100;

    const snapshot = await adminDb
      .collection(COLLECTIONS.SOCIETY_JOIN_REQUESTS)
      .orderBy("created_at", "desc")
      .limit(200)
      .get();

    const requests = snapshot.docs
      .map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          society_id: String(data.society_id || ""),
          society_name: (data.society_name as string | null) || null,
          user_id: String(data.user_id || ""),
          user_email: (data.user_email as string | null) || null,
          user_name: (data.user_name as string | null) || null,
          message: (data.message as string | null) || null,
          status: (data.status as string | null) || "submitted",
          created_at: toIso(data.created_at),
          updated_at: toIso(data.updated_at),
          reviewed_at: data.reviewed_at ? toIso(data.reviewed_at) : null,
          reviewed_by: (data.reviewed_by as string | null) || null,
          decision_note: (data.decision_note as string | null) || null,
        };
      })
      .filter((item) => (status === "all" ? true : item.status === status))
      .slice(0, limit);

    return NextResponse.json({ requests, statusFilter: status });
  } catch (error) {
    console.error("GET /api/admin/societies/join-requests error:", error);
    return NextResponse.json(
      { error: "Failed to load join requests" },
      { status: 500 }
    );
  }
}
