import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("OutboundCallApi");

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);
    const to = readString(body.to);
    if (!to) return NextResponse.json({ error: "to required" }, { status: 400 });

    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_CALLER_ID) {
      return NextResponse.json({ error: "Twilio not configured. See MEETING_ASSISTANT.md" }, { status: 501 });
    }

    // NOTE: This is a stub. Integrate Twilio (server-side) or a telephony provider here.
    // When Twilio is configured, create the call and return the call SID.

    return NextResponse.json({ success: true, message: "Call requested (stub). Configure Twilio to enable." });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Failed to request outbound call", error);
    return NextResponse.json({ error: "Failed to request outbound call" }, { status: 500 });
  }
}
