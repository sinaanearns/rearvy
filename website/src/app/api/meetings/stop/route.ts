import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type") || "";
    let payload: any = {};

    if (contentType.includes("application/json")) {
      payload = await request.json();
    } else if (contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      payload.meetingId = form.get("meetingId")?.toString();
      // `audio` blob handling should upload to storage (Firebase Storage / S3)
      // For this prototype we accept the upload and let background workers process it.
    } else {
      payload = await request.json().catch(() => ({}));
    }

    const { meetingId, recordingUrl, transcription } = payload;
    if (!meetingId) {
      return NextResponse.json({ error: "meetingId required" }, { status: 400 });
    }

    await adminDb.collection("meetings").doc(meetingId).update({
      endedAt: new Date().toISOString(),
      status: "stopped",
      recordingUrl: recordingUrl || null,
      transcription: transcription || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to stop meeting", error);
    return NextResponse.json({ error: "Failed to stop meeting" }, { status: 500 });
  }
}
