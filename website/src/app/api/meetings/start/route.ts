import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, participants } = body || {};

    const docRef = await adminDb.collection("meetings").add({
      userId: data.user.id,
      title: title || "Untitled meeting",
      participants: participants || [],
      startedAt: new Date().toISOString(),
      status: "recording",
    });

    return NextResponse.json({ success: true, meetingId: docRef.id });
  } catch (error) {
    console.error("Failed to start meeting", error);
    return NextResponse.json({ error: "Failed to start meeting" }, { status: 500 });
  }
}
