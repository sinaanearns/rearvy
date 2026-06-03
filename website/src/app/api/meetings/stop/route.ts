import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";

type StopMeetingPayload = {
  meetingId?: string;
  recordingUrl?: string;
  transcription?: string;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function parseJsonPayload(value: unknown): StopMeetingPayload {
  if (typeof value !== "object" || value === null) return {};

  const payload = value as Record<string, unknown>;
  return {
    meetingId: optionalString(payload.meetingId),
    recordingUrl: optionalString(payload.recordingUrl),
    transcription: optionalString(payload.transcription),
  };
}

async function readStopMeetingPayload(request: NextRequest): Promise<StopMeetingPayload> {
  const contentType = request.headers.get("content-type") || "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    // `audio` blob handling should upload to storage (Firebase Storage / S3).
    // For this prototype we accept the upload and let background workers process it.
    return {
      meetingId: optionalString(form.get("meetingId")?.toString()),
    };
  }

  if (!contentType.includes("application/json")) {
    try {
      return parseJsonPayload(await request.json());
    } catch {
      return {};
    }
  }

  try {
    return parseJsonPayload(await request.json());
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { meetingId, recordingUrl, transcription } = await readStopMeetingPayload(request);
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
