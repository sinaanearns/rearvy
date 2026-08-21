/**
 * Detects when the user wants Rearvy to generate an image via ChatGPT's browser
 * interface (DALL·E). When detected, the browser automation opens chatgpt.com,
 * types the extracted prompt, waits for image generation, and saves the result.
 */

export type ChatGptImageIntent = {
  /** The clean image prompt to send to ChatGPT — stripped of the trigger phrase. */
  prompt: string;
  /** Suggested output format if the user specified one (e.g. "png", "jpg"). */
  format: "png" | "jpg" | "webp" | null;
};

// ---------------------------------------------------------------------------
// Patterns
// ---------------------------------------------------------------------------

/**
 * Matches trigger verbs indicating image generation, including common typos.
 */
const VERB_PATTERN =
  /\b(?:genrate|generat|gnerate|genereate|genret|generate|create|make|draw|paint|sketch|design|produce|render|build|dalle)\b/i;

/**
 * Matches image noun keywords.
 */
const IMAGE_NOUN_PATTERN =
  /\b(?:image|picture|photo|photograph|illustration|drawing|artwork|painting|sketch|portrait|wallpaper|thumbnail|icon|logo|banner|png|jpg|jpeg|webp|graphic|render|visual|mockup)s?\b/i;

/**
 * Matches the trigger verbs that indicate image generation intent.
 * Group 1 captures the verb/phrase so it can be stripped from the prompt.
 */
const IMAGE_GEN_TRIGGER_PATTERN =
  /^(?:please\s+)?(?:can\s+you\s+)?(?:hey\s+rearvy[,\s]+)?(?:i\s+(?:want|need)\s+(?:you\s+to\s+)?)?(?:go\s+(?:on|to)\s+chatgpt\s+(?:and\s+)?)?(?:(?:draw|paint|sketch)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?|(?:genrate|generat|gnerate|genereate|genret|generate|create|make|design|produce|render|build|get|give\s+me|show\s+me)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?(?:(?:new\s+|cool\s+|quick\s+|simple\s+|realistic\s+|detailed\s+|high[-\s]?quality\s+|4k\s+|hd\s+)?(?:image|picture|photo|photograph|illustration|drawing|artwork|painting|sketch|portrait|wallpaper|thumbnail|icon|logo|banner|png|jpg|jpeg|webp|graphic|render|visual|mockup|design)s?\s+(?:of\s+|for\s+|showing\s+|depicting\s+|with\s+)?|png\s+of\s+|jpg\s+of\s+|jpeg\s+of\s+|image\s+of\s+|picture\s+of\s+|photo\s+of\s+))/i;

/** Matches "using chatgpt" / "on chatgpt" / "via chatgpt" / "with chatgpt" suffixes. */
const CHATGPT_SUFFIX_PATTERN =
  /\s+(?:using|via|with|on|through|in|from)\s+chatgpt\s*$/i;

/** Matches an explicit format request anywhere in the text. */
const FORMAT_PATTERN = /\b(png|jpg|jpeg|webp)\b/i;

/** Matches direct "generate PNG of ..." phrasing without a preceding verb. */
const SHORTHAND_PNG_PATTERN =
  /^(?:genrate|generat|gnerate|genereate|genret|generate|create|make)\s+(?:a\s+|an\s+)?(?:png|jpg|jpeg|webp)\s+(?:of\s+|for\s+|showing\s+|depicting\s+)?(.+)$/i;

/**
 * Phrases that look like image-gen but are clearly about something else
 * (e.g. "generate a report", "create a document", "make a plan").
 */
const FALSE_POSITIVE_PATTERN =
  /\b(?:report|document|doc|pdf|spreadsheet|presentation|slide|slides|plan|proposal|email|message|summary|script|code|component|page|website|app|list|table|chart|graph|diagram|map|template|checklist)\b/i;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeText(value: string | null | undefined): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function extractFormat(text: string): ChatGptImageIntent["format"] {
  const match = text.match(FORMAT_PATTERN);
  if (!match) return null;
  const fmt = match[1].toLowerCase();
  if (fmt === "jpeg") return "jpg";
  if (fmt === "png" || fmt === "jpg" || fmt === "webp") return fmt;
  return null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Detects whether the user's message is a request to generate an image via
 * ChatGPT's browser interface.
 *
 * @returns `ChatGptImageIntent` with the clean prompt, or `null` if not detected.
 */
export function detectChatGptImageIntent(
  text: string | null | undefined
): ChatGptImageIntent | null {
  const normalized = normalizeText(text);
  if (!normalized) return null;

  // Block false positives (e.g. "generate a report", "create a document")
  if (FALSE_POSITIVE_PATTERN.test(normalized)) return null;

  const hasVerb = VERB_PATTERN.test(normalized);
  const hasImageNoun = IMAGE_NOUN_PATTERN.test(normalized);
  const mentionsChatGPT = /\bchatgpt\b/i.test(normalized);
  const mentionsDalle = /\bdall[-·]?e\b/i.test(normalized);

  if (!hasVerb && !hasImageNoun && !mentionsChatGPT && !mentionsDalle) {
    return null;
  }

  const isImageRequest =
    (hasVerb && hasImageNoun) ||
    SHORTHAND_PNG_PATTERN.test(normalized) ||
    IMAGE_GEN_TRIGGER_PATTERN.test(normalized) ||
    ((mentionsChatGPT || mentionsDalle) && (hasVerb || hasImageNoun));

  if (!isImageRequest) {
    return null;
  }

  const format = extractFormat(normalized);

  let prompt = normalized;

  // 1. Remove prefixes like "please can you", "go on chatgpt and", "hey rearvy"
  prompt = prompt
    .replace(/^(?:please\s+)?(?:can\s+you\s+)?(?:hey\s+rearvy[,\s]+)?(?:i\s+(?:want|need)\s+(?:you\s+to\s+)?)?(?:go\s+(?:on|to)\s+chatgpt\s+(?:and\s+)?)?/i, "")
    .trim();

  // 2. Remove verbs like "genrate", "generate", "create", "make", "draw"
  prompt = prompt
    .replace(/^(?:genrate|generat|gnerate|genereate|genret|generate|create|make|draw|paint|sketch|design|produce|render|build)\s+(?:me\s+)?(?:a\s+|an\s+|the\s+)?/i, "")
    .trim();

  // 3. Handle "image of X" or "a png of X" prefix
  prompt = prompt
    .replace(/^(?:(?:new\s+|cool\s+|quick\s+|simple\s+|realistic\s+|detailed\s+|high[-\s]?quality\s+|4k\s+|hd\s+)?(?:image|picture|photo|photograph|illustration|drawing|artwork|painting|sketch|portrait|wallpaper|thumbnail|icon|logo|banner|png|jpg|jpeg|webp|graphic|render|visual|mockup)s?\s+(?:of\s+|for\s+|showing\s+|depicting\s+|with\s+)?|png\s+of\s+|jpg\s+of\s+|jpeg\s+of\s+|image\s+of\s+|picture\s+of\s+|photo\s+of\s+)/i, "")
    .trim();

  // 4. Remove ChatGPT / DALL-E suffixes first
  prompt = prompt
    .replace(CHATGPT_SUFFIX_PATTERN, "")
    .replace(/\s+(?:using|on|via|with|in)\s+dall[-·]?e\s*$/i, "")
    .trim();

  // 5. Handle "X image" or "X picture" suffix (e.g. "a chicken image" -> "chicken")
  prompt = prompt
    .replace(/\s+(?:new\s+|cool\s+|quick\s+|simple\s+|realistic\s+|detailed\s+|high[-\s]?quality\s+|4k\s+|hd\s+)?(?:image|picture|photo|photograph|illustration|drawing|artwork|painting|sketch|portrait|wallpaper|thumbnail|icon|logo|banner|png|jpg|jpeg|webp|graphic|render|visual|mockup)s?$/i, "")
    .trim();

  if (!prompt || prompt.length < 3) return null;

  return { prompt, format };
}

/**
 * Builds the browser automation task instruction for ChatGPT image generation.
 * This is passed directly to the `runBrowserTask` tool.
 */
export function buildChatGptImageTaskInstruction(intent: ChatGptImageIntent): string {
  const formatHint = intent.format
    ? `The user wants a ${intent.format.toUpperCase()} file. `
    : "";

  const timestamp = Date.now();
  const safeFilename = `rearvy-image-${timestamp}.${intent.format ?? "png"}`;

  return [
    `Navigate to https://chatgpt.com and wait for the page to fully load.`,
    `If an authentication modal, login or landing page appears, click "Try it first" (at the bottom of the page/modal) or "Stay logged out" to bypass and proceed directly into the ChatGPT chat interface. If "Try it first" is not available, click "Continue with Google" or "Log In" and prompt the user to complete sign-in in the open browser preview.`,
    `Once on the ChatGPT home or chat page, click on the chat input field (the text area at the bottom of the page).`,
    `Type exactly the following image generation prompt: "Generate an image of ${intent.prompt}. Make it high quality."`,
    `Press Enter to submit the prompt and wait patiently for the image to fully generate — this can take up to 60 seconds. Do not stop early.`,
    `Once the image appears in the chat, right-click on the generated image and select "Save Image As" (or the equivalent option in the browser context menu). ${formatHint}`,
    `Save the file to the user's Downloads folder with the filename: "${safeFilename}".`,
    `After saving, report back to the user with: the full saved file path, a brief description of what the image looks like, and confirm that the image was successfully generated by ChatGPT.`,
    `If ChatGPT shows a message saying image generation is unavailable (e.g. requires a Plus subscription or is temporarily down), report this clearly to the user and suggest they upgrade their ChatGPT plan to use DALL·E image generation.`,
    `If the browser session cannot reach chatgpt.com, report the connectivity issue clearly.`,
  ].join(" ");
}
