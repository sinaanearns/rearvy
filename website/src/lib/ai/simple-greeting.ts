export type SimpleGreetingIntent = {
  salutation: "hey" | "hello" | "hi" | "good-morning" | "good-afternoon" | "good-evening";
};

const GREETING_NORMALIZER_PATTERN = /[^a-z0-9'\s]/gi;
const ACTION_WORD_PATTERN =
  /\b(?:open|browse|search|find|send|write|draft|create|make|generate|analyze|check|show|tell|fix|run|click|login|log in|sign up|signup|connect|research|trade|buy|sell)\b/i;

function normalizeGreetingText(value: string) {
  return value
    .toLowerCase()
    .replace(GREETING_NORMALIZER_PATTERN, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function detectSimpleGreetingIntent(
  value: string | null | undefined
): SimpleGreetingIntent | null {
  if (!value) {
    return null;
  }

  const text = normalizeGreetingText(value);
  if (!text || text.length > 64 || ACTION_WORD_PATTERN.test(text)) {
    return null;
  }

  if (/^good morning(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "good-morning" };
  }

  if (/^good afternoon(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "good-afternoon" };
  }

  if (/^good evening(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "good-evening" };
  }

  if (/^(?:he+y+|yo+|howdy|sup|wassup)(?: there)?(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "hey" };
  }

  if (/^h+i+(?: there)?(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "hi" };
  }

  if (/^hello+(?: there)?(?: rearvy| maria)?$/.test(text)) {
    return { salutation: "hello" };
  }

  if (/^(?:he+y+|h+i+|hello+) how (?:are you|is it going)(?: rearvy| maria)?$/.test(text)) {
    return { salutation: text.startsWith("hello") ? "hello" : text.startsWith("hi") ? "hi" : "hey" };
  }

  return null;
}

export function buildSimpleGreetingResponse(intent: SimpleGreetingIntent) {
  if (intent.salutation === "good-morning") {
    return "Good morning. What would you like to work on?";
  }

  if (intent.salutation === "good-afternoon") {
    return "Good afternoon. What would you like to work on?";
  }

  if (intent.salutation === "good-evening") {
    return "Good evening. What would you like to work on?";
  }

  if (intent.salutation === "hello") {
    return "Hello. What would you like to work on?";
  }

  if (intent.salutation === "hi") {
    return "Hi. What would you like to work on?";
  }

  return "Hey. What would you like to work on?";
}
