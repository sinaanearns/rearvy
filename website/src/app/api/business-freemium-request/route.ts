import { NextRequest, NextResponse } from "next/server";
import sendgrid from "@sendgrid/mail";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const BUSINESS_FREEMIUM_RECIPIENT =
  process.env.BUSINESS_FREEMIUM_RECIPIENT || "myrearvy@gmail.com";
const SENDGRID_SENDER =
  process.env.SENDGRID_SENDER || BUSINESS_FREEMIUM_RECIPIENT;
const log = createServerLogger("BusinessFreemiumRequestApi");

let sendgridConfigured = false;

function ensureSendGridConfigured() {
  if (!SENDGRID_API_KEY) {
    return false;
  }

  if (!sendgridConfigured) {
    sendgrid.setApiKey(SENDGRID_API_KEY);
    sendgridConfigured = true;
  }

  return true;
}

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

    if (!ensureSendGridConfigured()) {
      return NextResponse.json(
        { error: "Email service is not configured yet." },
        { status: 500 }
      );
    }

    await sendgrid.send({
      to: BUSINESS_FREEMIUM_RECIPIENT,
      from: SENDGRID_SENDER,
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
