import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { to, meetingId } = body || {};
    if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_CALLER_ID) {
      return NextResponse.json({ error: "Twilio not configured. See MEETING_ASSISTANT.md" }, { status: 501 });
    }

    // NOTE: This is a stub. Integrate Twilio (server-side) or a telephony provider here.
    // When Twilio is configured, create the call and return the call SID.

    return NextResponse.json({ success: true, message: "Call requested (stub). Configure Twilio to enable." });
  } catch (error) {
    console.error("Failed to request outbound call", error);
    return NextResponse.json({ error: "Failed to request outbound call" }, { status: 500 });
  }
}
