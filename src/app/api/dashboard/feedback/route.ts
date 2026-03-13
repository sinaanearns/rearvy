import { NextRequest, NextResponse } from "next/server";

import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";

type FeedbackType = "issue" | "feature";

function isFeedbackType(value: unknown): value is FeedbackType {
  return value === "issue" || value === "feature";
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const type = body?.type;
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    const page = typeof body?.page === "string" ? body.page.trim() : "";

    if (!isFeedbackType(type)) {
      return NextResponse.json(
        { error: "Feedback type must be issue or feature." },
        { status: 400 }
      );
    }

    if (message.length < 5) {
      return NextResponse.json(
        { error: "Feedback must be at least 5 characters long." },
        { status: 400 }
      );
    }

    if (message.length > 1000) {
      return NextResponse.json(
        { error: "Feedback must be 1000 characters or fewer." },
        { status: 400 }
      );
    }

    await adminDb.collection(COLLECTIONS.FEEDBACK_SUBMISSIONS).add({
      user_id: data.user.id,
      user_email: data.user.email,
      type,
      message,
      page: page || "/",
      status: "open",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error creating feedback submission:", error);
    return NextResponse.json(
      { error: "Failed to send feedback." },
      { status: 500 }
    );
  }
}