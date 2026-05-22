import { NextRequest, NextResponse } from "next/server";

import { getUserFromRequest } from "@/lib/firebase/server";
import sendgrid from "@sendgrid/mail";

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || "";
const FEEDBACK_RECIPIENT = process.env.FEEDBACK_RECIPIENT || "mutalvita@gmail.com";
const SENDGRID_SENDER = process.env.SENDGRID_SENDER || FEEDBACK_RECIPIENT;

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

    // Send feedback via SendGrid email to the configured recipient.
    if (!ensureSendGridConfigured()) {
      return NextResponse.json(
        { error: "Email service not configured. Please contact the site owner." },
        { status: 500 }
      );
    }

    const subject = `Rearvy Feedback (${type}) from ${data.user.email || data.user.id}`;
    const text = `User: ${data.user.id}\nEmail: ${data.user.email}\nType: ${type}\nPage: ${page || "/"}\n\nMessage:\n${message}\n\nSent at: ${new Date().toISOString()}`;

    try {
      await sendgrid.send({
        to: FEEDBACK_RECIPIENT,
        from: SENDGRID_SENDER,
        subject,
        text,
      });

      return NextResponse.json({ success: true });
    } catch (err) {
      console.error("Error sending feedback email:", err);
      return NextResponse.json({ error: "Failed to send feedback email." }, { status: 500 });
    }
  } catch (error) {
    console.error("Error creating feedback submission:", error);
    return NextResponse.json(
      { error: "Failed to send feedback." },
      { status: 500 }
    );
  }
}
