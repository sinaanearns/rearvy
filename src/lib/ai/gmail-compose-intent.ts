import type { GmailComposeToolInput } from "@/lib/integrations/gmail/compose-shared";

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const COMPOSE_VERB_PATTERN = /\b(?:draft|compose|write|prepare|create|send)\b/i;
const EMAIL_WORD_PATTERN = /\b(?:email|e-mail|gmail|mail|message)\b/i;
const BUG_REPORT_PATTERN =
  /\b(?:not working|doesn't work|doesnt work|failed|failure|error|bug|issue|broken|fix this|fix it)\b/i;

export type GmailComposeIntent =
  | {
      kind: "compose";
      input: GmailComposeToolInput;
    }
  | {
      kind: "needs-recipient";
      message: string;
    };

type GmailComposeIntentContext = {
  businessName?: string | null;
};

function uniqueEmails(value: string) {
  const emails = value.match(EMAIL_PATTERN) || [];
  const seen = new Set<string>();

  return emails.filter((email) => {
    const normalized = email.toLowerCase();
    if (seen.has(normalized)) {
      return false;
    }

    seen.add(normalized);
    return true;
  });
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function sentenceCase(value: string) {
  const normalized = normalizeWhitespace(value);
  if (!normalized) {
    return normalized;
  }

  return `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`;
}

function cleanupBrief(value: string) {
  return normalizeWhitespace(value)
    .replace(/^[:,-]\s*/, "")
    .replace(/\bthere business\b/gi, "their business")
    .replace(/\brearvy\b/gi, "Rearvy")
    .replace(/[.?!]*$/, "")
    .trim();
}

function extractSubject(text: string) {
  const subjectMatch = text.match(/\bsubject\s*:\s*([^.\n\r]+)/i);
  return cleanupBrief(subjectMatch?.[1] || "");
}

function extractBrief(text: string) {
  const markerMatch = text.match(
    /\b(?:saying|say|telling|tell|that|about|regarding|body\s*:)\b\s*([\s\S]+)/i
  );

  if (markerMatch?.[1]) {
    return cleanupBrief(markerMatch[1]);
  }

  const withoutEmails = text.replace(EMAIL_PATTERN, " ");
  const fallback = withoutEmails
    .replace(COMPOSE_VERB_PATTERN, " ")
    .replace(EMAIL_WORD_PATTERN, " ")
    .replace(/\b(?:to|for|with|a|an|the)\b/gi, " ");

  return cleanupBrief(fallback);
}

function isRearvyHelpBrief(brief: string) {
  return /\brearvy\b/i.test(brief) && /\bhelp|business|growth|work\b/i.test(brief);
}

function inferSubject(brief: string) {
  if (isRearvyHelpBrief(brief)) {
    return "How Rearvy can help your business";
  }

  if (/\bthank|thanks|appreciate\b/i.test(brief)) {
    return "Thank you";
  }

  if (brief) {
    const subject = sentenceCase(brief).slice(0, 72);
    return subject.length < brief.length ? `${subject.trim()}...` : subject;
  }

  return "Quick update";
}

function inferSignature(context: GmailComposeIntentContext) {
  const businessName = normalizeWhitespace(context.businessName || "");
  return businessName || "Rearvy";
}

function buildBody(brief: string, context: GmailComposeIntentContext) {
  const signature = inferSignature(context);

  if (isRearvyHelpBrief(brief)) {
    return [
      "Hi,",
      "",
      "I wanted to share how Rearvy can help your business.",
      "",
      "Rearvy brings your sales, marketing, customer conversations, and performance signals into one workspace so you can see what is changing without jumping between tools. It can highlight revenue movement, summarize important activity, surface customer patterns, and turn scattered data into clear next steps.",
      "",
      "For a growing business, that means faster decisions, fewer missed opportunities, and a practical way to know where to focus each day.",
      "",
      "Best,",
      signature,
    ].join("\n");
  }

  const message = brief
    ? sentenceCase(brief)
    : "I wanted to send you a quick update.";

  return ["Hi,", "", message, "", "Best,", signature].join("\n");
}

function shouldSendNow(text: string) {
  return /\bsend\b/i.test(text) && !/\b(?:draft|prepare|compose|write)\b/i.test(text);
}

export function detectGmailComposeIntent(
  userText: string,
  context: GmailComposeIntentContext = {}
): GmailComposeIntent | null {
  const normalizedText = normalizeWhitespace(userText);
  if (!normalizedText) {
    return null;
  }

  const recipients = uniqueEmails(normalizedText);
  const hasComposeIntent =
    COMPOSE_VERB_PATTERN.test(normalizedText) &&
    (EMAIL_WORD_PATTERN.test(normalizedText) || EMAIL_PATTERN.test(normalizedText));

  if (!hasComposeIntent) {
    return null;
  }

  if (BUG_REPORT_PATTERN.test(normalizedText) && recipients.length === 0) {
    return null;
  }

  if (recipients.length === 0) {
    return {
      kind: "needs-recipient",
      message: "Who should I send it to? Please include the recipient email address.",
    };
  }

  const brief = extractBrief(normalizedText);
  const explicitSubject = extractSubject(normalizedText);
  const subject = explicitSubject || inferSubject(brief);

  return {
    kind: "compose",
    input: {
      to: recipients,
      cc: [],
      bcc: [],
      subject,
      body: buildBody(brief, context),
      sendNowPreferred: shouldSendNow(normalizedText),
    },
  };
}
