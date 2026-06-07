import { NextRequest, NextResponse } from "next/server";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { isResendConfigured, sendResendEmail } from "@/lib/email/resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const BUSINESS_FREEMIUM_RECIPIENT =
  process.env.BUSINESS_FREEMIUM_RECIPIENT || "myrearvy@gmail.com";
const BUSINESS_FREEMIUM_SENDER =
  process.env.RESEND_SENDER || "Rearvy <onboarding@resend.dev>";
const log = createServerLogger("BusinessFreemiumRequestApi");

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isGmailAddress(value: string) {
  return /^[^\s@]+@gmail\.com$/i.test(value);
}

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonRecord(request);
    const businessName = readString(body?.businessName);
    const plannedUse = readString(body?.plannedUse);
    const gmail = readString(body?.gmail).toLowerCase();

    if (businessName.length < 2 || businessName.length > 120) {
      return NextResponse.json(
        { error: "Business name must be between 2 and 120 characters." },
        { status: 400 }
      );
    }

    if (plannedUse.length < 10 || plannedUse.length > 1000) {
      return NextResponse.json(
        { error: "Usage plan must be between 10 and 1000 characters." },
        { status: 400 }
      );
    }

    if (!isGmailAddress(gmail)) {
      return NextResponse.json(
        { error: "Enter a valid Gmail address." },
        { status: 400 }
      );
    }

    if (
      !isResendConfigured({
        apiKey: RESEND_API_KEY,
        from: BUSINESS_FREEMIUM_SENDER,
      })
    ) {
      return NextResponse.json(
        { error: "Email service is not configured yet." },
        { status: 500 }
      );
    }

    await sendResendEmail({
      apiKey: RESEND_API_KEY,
      to: BUSINESS_FREEMIUM_RECIPIENT,
      from: BUSINESS_FREEMIUM_SENDER,
      replyTo: gmail,
      subject: `Rearvy free Business request from ${businessName}`,
      text: [
        "New Rearvy business freemium request",
        "",
        `Business name: ${businessName}`,
        `Gmail: ${gmail}`,
        "",
        "How they plan to use Rearvy:",
        plannedUse,
        "",
        `Sent at: ${new Date().toISOString()}`,
      ].join("\n"),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error sending business freemium request:", error);
    return NextResponse.json(
      { error: "Failed to send business freemium request." },
      { status: 500 }
    );
  }
}
