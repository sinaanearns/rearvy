import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("MeetingStartRoute");

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);
    const title = optionalString(body.title);
    const participants = Array.isArray(body.participants)
      ? body.participants.filter((item): item is string => typeof item === "string")
      : [];

    const docRef = await adminDb.collection("meetings").add({
      userId: data.user.id,
      title: title || "Untitled meeting",
      participants,
      startedAt: new Date().toISOString(),
      status: "recording",
    });

    return NextResponse.json({ success: true, meetingId: docRef.id });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to start meeting", error);
    return NextResponse.json({ error: "Failed to start meeting" }, { status: 500 });
  }
}
