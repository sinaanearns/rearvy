import { generateText } from "ai";
import { resolveModelForChat, buildNoModelConfiguredMessage } from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("Email:SmartReply");

export interface SmartReplyCandidate {
  subject: string;
  body: string;
  tone: "professional" | "casual" | "urgent";
}

/**
 * Generates 3 email reply candidates using the AI model router.
 * Candidates are strictly drafts — they are never sent automatically.
 */
export async function generateSmartReplies(params: {
  userId: string;
  incomingSubject: string;
  incomingBody: string;
  senderName?: string;
  isDesktopApp?: boolean;
}): Promise<SmartReplyCandidate[]> {
  const { incomingSubject, incomingBody, senderName = "Sender", isDesktopApp = false } = params;

  log.info(`Generating replies for subject: "${incomingSubject}"`);

  const routed = await resolveModelForChat({
    task: "email_draft",
    routingMode: "fast",
    isDesktopApp,
  });

  if (!routed.model) {
    throw new Error(buildNoModelConfiguredMessage());
  }

  const prompt = [
    `You are Rearvy's Email Assistant. Generate exactly three short reply drafts to the email below.`,
    `---`,
    `FROM: ${senderName}`,
    `SUBJECT: ${incomingSubject}`,
    `BODY:`,
    incomingBody.substring(0, 1500),
    `---`,
    `REQUIREMENTS:`,
    `- Output a valid JSON array of objects conforming to the schema below. Do not wrap the JSON in markdown formatting blocks or include any extra text.`,
    `- Schema: Array<{ subject: string, body: string, tone: 'professional' | 'casual' | 'urgent' }>`,
    `- Output exactly 3 objects with distinct tones.`,
    `- Keep bodies extremely brief (2-4 sentences max).`,
  ].join("\n");

  try {
    const { text } = await generateText({
      model: routed.model,
      prompt,
    });

    // Clean any markdown formatting wrap if LLM fails to output raw JSON
    const jsonText = text.replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
    const candidates = JSON.parse(jsonText) as SmartReplyCandidate[];

    log.info(`Smart replies generated successfully.`);
    return candidates;
  } catch (error) {
    log.error("Failed to generate smart replies", error);
    // Return hardcoded default candidates on failure
    const subject = incomingSubject.startsWith("Re:") ? incomingSubject : `Re: ${incomingSubject}`;
    return [
      {
        subject,
        body: "Thank you for the message. I will review and get back to you shortly.",
        tone: "professional",
      },
      {
        subject,
        body: "Thanks! Got it. Talk to you soon.",
        tone: "casual",
      },
      {
        subject,
        body: "Received. I am looking into this right now and will update you ASAP.",
        tone: "urgent",
      },
    ];
  }
}
