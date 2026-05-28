export type GeneratedMediaMode = "image" | "video";

const SPEC_STYLE_PROMPT_PATTERN =
  /^a detailed description of\s+(.+?)\.\s+show\b[\s\S]*?\bdesign\b[\s\S]*?\bcolor scheme\b[\s\S]*?\blayout\b/i;

const TEXT_REQUEST_PATTERN =
  /\b(?:text|word|words|lettering|caption|title|label|logo|poster|banner|typography|sign|says|say|ui|interface|website|app screen|mockup|layout|chart|diagram|infographic)\b/i;
const IMAGE_ENHANCEMENT_GUIDANCE =
  "Preserve every explicit user detail. Use a clear main subject, intentional composition, coherent proportions, appropriate lighting, rich textures, sharp details, depth, and a polished finished look. Do not add unrelated elements.";
const TEXT_RENDERING_GUIDANCE =
  "Render any requested visible text exactly as written and keep it legible.";
const NO_TEXT_GUARD =
  "Avoid rendered text, labels, UI mockups, charts, and layout diagrams unless explicitly requested.";

const COMMON_VISUAL_TERM_CORRECTIONS: Array<[RegExp, string]> = [
  [/\bchickebn\b/gi, "chicken"],
  [/\bchiken\b/gi, "chicken"],
  [/\bchickn\b/gi, "chicken"],
];

function normalizePromptText(value: string) {
  return value
    .normalize("NFKC")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSurroundingQuotes(value: string) {
  return value.replace(/^["'`]+|["'`]+$/g, "").trim();
}

function stripTrailingSentencePunctuation(value: string) {
  return value.replace(/[.?!]+$/g, "").trim();
}

function applyCommonVisualCorrections(value: string) {
  return COMMON_VISUAL_TERM_CORRECTIONS.reduce(
    (nextValue, [pattern, replacement]) => nextValue.replace(pattern, replacement),
    value
  );
}

function countWords(value: string) {
  return value.match(/[a-z0-9]+/gi)?.length ?? 0;
}

function withArticleForSingleSubject(value: string) {
  if (!/^[a-z][a-z-]*$/i.test(value) || /^(?:a|an|the)$/i.test(value)) {
    return value;
  }

  const article = /^[aeiou]/i.test(value) ? "an" : "a";
  return `${article} ${value}`;
}

function frameSimpleImagePrompt(value: string) {
  if (/^(?:a clear image of|an? image of|an? photo of|photo of|photorealistic|cinematic|illustration of)\b/i.test(value)) {
    return value;
  }

  if (countWords(value) <= 6 && !/[,:;]/.test(value)) {
    return `A clear image of ${withArticleForSingleSubject(value)}`;
  }

  return value;
}

function appendGuidance(value: string, guidance: string) {
  if (value.includes(guidance)) {
    return value;
  }

  return `${stripTrailingSentencePunctuation(value)}. ${stripTrailingSentencePunctuation(guidance)}.`;
}

function enhanceImagePrompt(value: string, allowsVisibleText: boolean) {
  const framed = frameSimpleImagePrompt(value);
  const withEnhancement = appendGuidance(framed, IMAGE_ENHANCEMENT_GUIDANCE);

  if (allowsVisibleText) {
    return appendGuidance(withEnhancement, TEXT_RENDERING_GUIDANCE);
  }

  return appendGuidance(withEnhancement, NO_TEXT_GUARD);
}

export function normalizeGeneratedMediaPrompt(
  prompt: string,
  mode: GeneratedMediaMode
) {
  let cleaned = stripSurroundingQuotes(normalizePromptText(prompt));

  const specStyleMatch = cleaned.match(SPEC_STYLE_PROMPT_PATTERN);
  if (specStyleMatch?.[1]) {
    cleaned = specStyleMatch[1];
  }

  cleaned = stripTrailingSentencePunctuation(
    applyCommonVisualCorrections(cleaned)
  );

  if (!cleaned) {
    return prompt.trim();
  }

  if (mode !== "image") {
    return cleaned;
  }

  return enhanceImagePrompt(cleaned, TEXT_REQUEST_PATTERN.test(cleaned));
}
