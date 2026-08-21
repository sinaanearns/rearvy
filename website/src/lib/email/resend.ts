import { readResponseJsonRecord } from "@/lib/api/request-body";

const RESEND_API_URL = "https://api.resend.com/emails";

type SendResendEmailParams = {
  apiKey: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  to: string | string[];
};

export function isResendConfigured({
  apiKey,
  from,
}: {
  apiKey: string;
  from: string;
}) {
  return Boolean(apiKey && from);
}

function getResendErrorMessage(value: Record<string, unknown>) {
  const name = typeof value.name === "string" ? value.name : "";
  const message = typeof value.message === "string" ? value.message : "";
  return [name, message].filter(Boolean).join(": ");
}

export async function readResendError(response: Response) {
  const payload = await readResponseJsonRecord(response);
  return getResendErrorMessage(payload);
}

export async function sendResendEmail({
  apiKey,
  from,
  replyTo,
  subject,
  text,
  to,
}: SendResendEmailParams) {
  const body: Record<string, unknown> = {
    from,
    to: Array.isArray(to) ? to : [to],
    subject,
    text,
  };

  if (replyTo) {
    body.reply_to = replyTo;
  }

  const response = await fetch(RESEND_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": "Rearvy Email",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const details = await readResendError(response);
    throw new Error(
      `Resend email failed with ${response.status}${details ? `: ${details}` : ""}`
    );
  }
}
