import {
  type MediaAspectRatio,
  resolveMediaAspectRatioFromText,
} from "./media-aspect-ratio";

export type MediaGenerationIntent = {
  mode: "image" | "video";
  prompt: string;
  aspectRatio?: MediaAspectRatio;
  presentation?: "design";
};

const IMAGE_INTENT_PATTERNS = [
  /^\/(?:imagine|image|img|draw|paint)\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render|draw|paint|illustrate|design)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(?:youtube|yt|instagram|insta|ig|cinematic)\s+(?:thumbnail|thumb|post|feed|story|reel|banner|cover)\s+(?:image|picture|photo|photograph|illustration|drawing|artwork|art|poster|logo|icon|wallpaper|render|sketch)\s+(?:of|for|showing|featuring|with|about)\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render|draw|paint|illustrate|design)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(?:youtube|yt|instagram|insta|ig|cinematic)\s+(?:image|picture|photo|photograph|illustration|drawing|artwork|art|poster|logo|icon|wallpaper|render|sketch|thumbnail|banner|cover|post|story|reel)\s+(?:of|for|showing|featuring|with|about)\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render|draw|paint|illustrate|design)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(?:image|picture|photo|photograph|illustration|drawing|artwork|art|poster|logo|icon|wallpaper|render|sketch|thumbnail|banner|cover)\s+(?:of|for|showing|featuring|with|about)\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(.+?)\s+(?:image|picture|photo|photograph|illustration|drawing|artwork|poster|logo|icon|wallpaper|render|sketch|thumbnail|banner|cover)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:draw|paint|illustrate)\s+(?:me\s+|for\s+me\s+)?(.+)$/i,
];

const VIDEO_INTENT_PATTERNS = [
  /^\/video\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(?:short\s+)?(?:video|clip|movie|animation|gif)\s+(?:of|for|showing|featuring|with|about)\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|render)\s+(?:me\s+|for\s+me\s+)?(?:an?\s+|some\s+|the\s+)?(.+?)\s+(?:short\s+)?(?:video|clip|movie|animation|gif)$/i,
];

const DESIGN_INTENT_PATTERNS = [
  /^\/design\s+(.+)$/i,
  /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:design|create|generate|produce|render|make)\s+(?:me\s+|for\s+me\s+)?(.+)$/i,
];

const VISUAL_DESIGN_TARGET_PATTERN =
  /\b(?:3[-\s]?view|bom|tech\s*pack|logo|brand(?:ing)?|product\s+design|packaging|pattern|mockup|render|sketch|drawing|illustration|mascot|character|poster|badge|label|icon|cup|mug|tea\s*cup|bottle|perfume|backpack|bag|tote|shoe|sneaker|watch|chair|lamp|desk|sofa|toy|t[-\s]?shirt|hoodie|jacket|dress|furniture|ceramic|textile|wallpaper)\b/i;
const SQUARE_DESIGN_PATTERN =
  /\b(?:logo|badge|icon|mark|avatar|pattern|label|sticker)\b/i;
const WIDE_DESIGN_PATTERN =
  /\b(?:tech\s*pack|3[-\s]?view|bom|blueprint|sheet|turnaround|orthographic)\b/i;
const VAGUE_MEDIA_TARGET_PATTERN = /^(?:it|this|that|one|an? image|an? video|the image|the video)$/i;

function normalizeIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanExtractedPrompt(value: string) {
  return value
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\s+(?:please|thanks|thank you)$/i, "")
    .replace(/[.?!]+$/g, "")
    .trim();
}

function firstPromptMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const prompt = cleanExtractedPrompt(match[1]);
      if (prompt && !VAGUE_MEDIA_TARGET_PATTERN.test(prompt)) {
        return prompt;
      }
    }
  }

  return null;
}

function firstDesignPromptMatch(text: string) {
  for (const pattern of DESIGN_INTENT_PATTERNS) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const prompt = cleanExtractedPrompt(match[1]);
    if (!prompt || VAGUE_MEDIA_TARGET_PATTERN.test(prompt)) {
      continue;
    }

    if (pattern.source.startsWith("^\\/design")) {
      return prompt;
    }

    if (VISUAL_DESIGN_TARGET_PATTERN.test(`${prompt} ${text}`)) {
      return prompt;
    }
  }

  return null;
}

function resolveDesignAspectRatio(text: string): MediaAspectRatio {
  if (WIDE_DESIGN_PATTERN.test(text)) {
    return "16:9";
  }

  if (SQUARE_DESIGN_PATTERN.test(text)) {
    return "1:1";
  }

  const explicitOrPlatformRatio = resolveMediaAspectRatioFromText(text, "image");
  return explicitOrPlatformRatio === "4:5" ? "1:1" : explicitOrPlatformRatio;
}

export function buildDesignMediaResultCopy(
  userText: string | null | undefined,
  prompt: string
) {
  const brief = cleanExtractedPrompt(
    normalizeIntentText(userText || prompt)
  );
  const designBrief = brief || cleanExtractedPrompt(prompt);

  return [
    "I've generated an AI design concept from your brief.",
    `The design turns "${designBrief}" into a polished visual direction. Review the task file below, then ask for refinements like colors, materials, views, or branding.`,
  ].join("\n\n");
}

export function detectMediaGenerationIntent(
  userText: string | null | undefined
): MediaGenerationIntent | null {
  const text = normalizeIntentText(userText);
  if (!text) {
    return null;
  }

  const designPrompt = firstDesignPromptMatch(text);
  if (designPrompt) {
    return {
      mode: "image",
      prompt: designPrompt,
      aspectRatio: resolveDesignAspectRatio(text),
      presentation: "design",
    };
  }

  const videoPrompt = firstPromptMatch(text, VIDEO_INTENT_PATTERNS);
  if (videoPrompt) {
    return {
      mode: "video",
      prompt: videoPrompt,
      aspectRatio: resolveMediaAspectRatioFromText(text, "video"),
    };
  }

  const imagePrompt = firstPromptMatch(text, IMAGE_INTENT_PATTERNS);
  if (imagePrompt) {
    return {
      mode: "image",
      prompt: imagePrompt,
      aspectRatio: resolveMediaAspectRatioFromText(text, "image"),
    };
  }

  return null;
}
