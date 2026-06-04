import {
  type DocumentGenerationToolInput,
  type GeneratedDocumentFormat,
  normalizeDocumentFormats,
} from "./document-generation";

type FormatMatch = {
  formats: GeneratedDocumentFormat[];
  sawDocumentTarget: boolean;
};

const CREATE_DOCUMENT_PATTERN =
  /\b(?:make|create|generate|produce|draft|write|build|prepare|turn|convert|export)\b/i;
const DOCUMENT_TARGET_PATTERN =
  /\b(?:pdf|docx?|word\s*(?:doc|document|file)?|microsoft\s*word|document|report|proposal|memo|brief|one[-\s]?pager|letter|invoice|contract|resume|cv)\b/i;
const DEBUG_CONTEXT_PATTERN =
  /\b(?:bug|code|compile|typescript|route|api|component|fix|debug|error|issue|not working|broken)\b/i;
const FILE_GENERATION_CONTEXT_PATTERN =
  /\b(?:pdf|docx?|word|document)\s+(?:generation|generator|tool|feature|route|api|bug|issue|error)\b/i;

const DOCUMENT_TYPE_PATTERNS: Array<[RegExp, string]> = [
  [/\bproposal\b/i, "proposal"],
  [/\breport\b/i, "report"],
  [/\bmemo\b/i, "memo"],
  [/\bbrief\b/i, "brief"],
  [/\bone[-\s]?pager\b/i, "one-pager"],
  [/\bletter\b/i, "letter"],
  [/\binvoice\b/i, "invoice"],
  [/\bcontract\b/i, "contract"],
  [/\bresume\b|\bcv\b/i, "resume"],
];

function normalizeIntentText(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanBrief(value: string) {
  return value
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/\b(?:as|into|to|in)\s+(?:a\s+|an\s+)?(?:pdf|docx?|word\s*(?:doc|document)?|microsoft\s*word|document)\b/gi, "")
    .replace(/\b(?:pdf|docx?|word\s*(?:doc|document|file)?|microsoft\s*word)\b/gi, "")
    .replace(/\b(?:and\s+)?(?:all\s+formats?|all\s+files?|everything)\b/gi, "")
    .replace(/^\s*(?:about|for|on|regarding|with|from|covering)\s+/i, "")
    .replace(/\s+(?:please|thanks|thank you)$/i, "")
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveFormats(text: string): FormatMatch {
  const lower = text.toLowerCase();
  const sawPdf = /\bpdf\b/.test(lower);
  const sawDocx = /\b(?:docx?|word\s*(?:doc|document|file)?|microsoft\s*word)\b/.test(lower);
  const sawMarkdown = /\b(?:markdown|md)\b/.test(lower);
  const sawText = /\b(?:txt|plain\s+text|text\s+file)\b/.test(lower);
  const sawHtml = /\bhtml\b/.test(lower);
  const sawAll =
    /\b(?:all\s+formats?|all\s+files?|everything)\b/.test(lower) ||
    (sawPdf && sawDocx && /\b(?:and|plus|with)\b/.test(lower));
  const formats: GeneratedDocumentFormat[] = [];

  if (sawAll) {
    return {
      formats: ["pdf", "docx", "markdown", "txt", "html"],
      sawDocumentTarget: true,
    };
  }

  if (sawPdf) formats.push("pdf");
  if (sawDocx) formats.push("docx");
  if (sawMarkdown) formats.push("markdown");
  if (sawText) formats.push("txt");
  if (sawHtml) formats.push("html");

  return {
    formats: normalizeDocumentFormats(formats),
    sawDocumentTarget: DOCUMENT_TARGET_PATTERN.test(text),
  };
}

function resolveDocumentType(text: string) {
  for (const [pattern, type] of DOCUMENT_TYPE_PATTERNS) {
    if (pattern.test(text)) {
      return type;
    }
  }

  return "document";
}

function extractTitle(text: string) {
  const match =
    text.match(/\b(?:titled|called|named)\s+["']?([^"']{3,80})["']?/i) ??
    text.match(/\btitle\s*:\s*["']?([^"']{3,80})["']?/i);

  return match?.[1] ? cleanBrief(match[1]).slice(0, 80) : undefined;
}

function extractBrief(text: string) {
  const patterns = [
    /^\/(?:pdf|docx?|word|document|doc)\s+(.+)$/i,
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|draft|write|build|prepare)\s+(?:me\s+|for\s+me\s+)?(?:a\s+|an\s+|the\s+)?(?:pdf|docx?|word\s*(?:doc|document|file)?|microsoft\s*word|document)\s+(?:about|for|on|regarding|with|from|covering)?\s*(.+)$/i,
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|draft|write|build|prepare)\s+(?:me\s+|for\s+me\s+)?(.+?)\s+(?:as|into|in)\s+(?:a\s+|an\s+|the\s+)?(?:pdf|docx?|word\s*(?:doc|document|file)?|microsoft\s*word|document)(?:\s+.*)?$/i,
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:make|create|generate|produce|draft|write|build|prepare)\s+(?:me\s+|for\s+me\s+)?(?:a\s+|an\s+|the\s+)?(.+)$/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) {
      continue;
    }

    const brief = cleanBrief(match[1]);
    if (brief) {
      return brief;
    }
  }

  return cleanBrief(text);
}

function shouldIgnoreAsEngineeringRequest(text: string) {
  return DEBUG_CONTEXT_PATTERN.test(text) && FILE_GENERATION_CONTEXT_PATTERN.test(text);
}

export function detectDocumentGenerationIntent(
  userText: string | null | undefined
): DocumentGenerationToolInput | null {
  const text = normalizeIntentText(userText);
  if (!text) {
    return null;
  }

  const isSlashCommand = /^\/(?:pdf|docx?|word|document|doc)\b/i.test(text);
  const formatMatch = resolveFormats(text);
  const hasCreateVerb = CREATE_DOCUMENT_PATTERN.test(text);
  const hasDocumentTarget = formatMatch.sawDocumentTarget;

  if (!isSlashCommand && (!hasCreateVerb || !hasDocumentTarget)) {
    return null;
  }

  if (!isSlashCommand && shouldIgnoreAsEngineeringRequest(text)) {
    return null;
  }

  const documentType = resolveDocumentType(text);
  const brief = extractBrief(text);
  const meaningfulBrief =
    brief && !/^(?:it|this|that|a|an|the|document|file)$/i.test(brief)
      ? brief
      : `${documentType} requested by the user`;

  return {
    brief: meaningfulBrief,
    formats: formatMatch.formats,
    documentType,
    title: extractTitle(text),
  };
}
