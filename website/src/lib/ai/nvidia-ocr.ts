import { parseProviderErrorResponse } from "@/lib/ai/provider-error";

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────

const DEFAULT_NVIDIA_OCR_MODEL = "nvidia/nemotron-ocr-v2";
const DEFAULT_NVIDIA_OCR_INFER_URL =
  "https://integrate.api.nvidia.com/v1/infer";

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────

/**
 * Supported image MIME types for Nemotron OCR v2.
 * The model handles PNG, JPEG, WEBP, and TIFF images.
 */
export type NvidiaOcrMimeType =
  | "image/png"
  | "image/jpeg"
  | "image/webp"
  | "image/tiff"
  | string;

export type NvidiaOcrInput = {
  /**
   * Raw base64-encoded image data (no data URL prefix needed —
   * the client will add the appropriate prefix).
   */
  imageBase64: string;
  /** MIME type of the image. Defaults to "image/png". */
  mimeType?: NvidiaOcrMimeType;
  /** Override the OCR model. Defaults to nvidia/nemotron-ocr-v2. */
  model?: string;
};

/**
 * A single recognized word with its bounding box and confidence.
 */
export type NvidiaOcrWord = {
  text: string;
  /** Normalized bounding box [x, y, width, height] in 0–1 range, or pixel coords. */
  bbox: [number, number, number, number] | null;
  confidence: number;
};

/**
 * A single page / region of recognized text.
 */
export type NvidiaOcrPage = {
  pageIndex: number;
  text: string;
  words: NvidiaOcrWord[];
};

export type NvidiaOcrResult = {
  provider: "nvidia";
  model: string;
  /** Full concatenated text across all detected regions. */
  text: string;
  /** Per-page / per-region breakdown. */
  pages: NvidiaOcrPage[];
  /** Flat list of all recognized words with bbox + confidence. */
  words: NvidiaOcrWord[];
  /** Average confidence across all words (0–1). */
  averageConfidence: number;
  /** Raw JSON response from the NIM endpoint for debugging. */
  raw?: unknown;
};

// ─────────────────────────────────────────────
// Config resolution
// ─────────────────────────────────────────────

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

type NvidiaOcrConfig = {
  apiKey: string | undefined;
  inferUrl: string;
  model: string;
};

function resolveNvidiaOcrConfig(model?: string): NvidiaOcrConfig {
  const apiKey =
    readEnv("NVIDIA_OCR_API_KEY") || readEnv("NVIDIA_API_KEY") || undefined;

  const inferUrl =
    readEnv("NVIDIA_OCR_INFER_URL") || DEFAULT_NVIDIA_OCR_INFER_URL;

  const resolvedModel =
    model?.trim() ||
    readEnv("NVIDIA_OCR_MODEL") ||
    DEFAULT_NVIDIA_OCR_MODEL;

  return { apiKey, inferUrl, model: resolvedModel };
}

/**
 * Returns true if the required environment variables for Nemotron OCR are set.
 */
export function hasNvidiaOcrConfig(): boolean {
  return Boolean(
    readEnv("NVIDIA_OCR_API_KEY") || readEnv("NVIDIA_API_KEY")
  );
}

/**
 * Returns a human-readable configuration error for when OCR is not configured.
 */
export function getNvidiaOcrConfigError(): string {
  return (
    "NVIDIA Nemotron OCR v2 requires NVIDIA_OCR_API_KEY (or NVIDIA_API_KEY) " +
    "to be set. Obtain your key from https://build.nvidia.com/."
  );
}

// ─────────────────────────────────────────────
// Request building
// ─────────────────────────────────────────────

/**
 * Strips an existing data URL prefix from a base64 string so we can
 * reconstruct it with the correct MIME type.
 */
function stripDataUrlPrefix(imageBase64: string): string {
  const match = imageBase64.match(/^data:[^;]+;base64,([\/\s\S]+)$/);
  return match ? match[1] : imageBase64;
}

function buildDataUrl(imageBase64: string, mimeType: string): string {
  const raw = stripDataUrlPrefix(imageBase64);
  return `data:${mimeType};base64,${raw}`;
}

function buildOcrRequestBody(
  input: NvidiaOcrInput,
  model: string
): Record<string, unknown> {
  const mimeType = input.mimeType?.trim() || "image/png";
  const dataUrl = buildDataUrl(input.imageBase64, mimeType);

  return {
    model,
    input: [
      {
        type: "image_url",
        url: dataUrl,
      },
    ],
  };
}

// ─────────────────────────────────────────────
// Response normalization
// ─────────────────────────────────────────────

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function safeNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function normalizeBbox(
  value: unknown
): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length < 4) {
    return null;
  }
  const [x, y, w, h] = value;
  if (
    typeof x !== "number" ||
    typeof y !== "number" ||
    typeof w !== "number" ||
    typeof h !== "number"
  ) {
    return null;
  }
  return [x, y, w, h];
}

function normalizeWord(raw: unknown): NvidiaOcrWord | null {
  if (!isRecord(raw)) return null;

  const text = safeString(raw.text || raw.word || raw.content);
  if (!text) return null;

  return {
    text,
    bbox: normalizeBbox(raw.bbox || raw.bounding_box || raw.box),
    confidence: safeNumber(raw.confidence || raw.score || raw.prob, 1.0),
  };
}

function extractWordsFromArray(items: unknown[]): NvidiaOcrWord[] {
  const words: NvidiaOcrWord[] = [];
  for (const item of items) {
    if (typeof item === "string" && item.trim()) {
      words.push({ text: item.trim(), bbox: null, confidence: 1.0 });
      continue;
    }
    const word = normalizeWord(item);
    if (word) words.push(word);
  }
  return words;
}

function extractFullText(raw: unknown): string {
  if (typeof raw === "string") return raw.trim();
  if (!isRecord(raw)) return "";

  // Try common top-level text fields
  const directText =
    safeString(raw.text) ||
    safeString(raw.content) ||
    safeString(raw.output) ||
    safeString(raw.recognized_text) ||
    safeString(raw.full_text);

  if (directText) return directText;

  // Try nested results / pages
  const results = raw.results || raw.pages || raw.outputs || raw.data;
  if (Array.isArray(results)) {
    return results
      .map((r) => {
        if (typeof r === "string") return r;
        if (isRecord(r)) {
          return safeString(
            r.text || r.content || r.output || r.recognized_text
          );
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

function extractWords(raw: unknown): NvidiaOcrWord[] {
  if (!isRecord(raw)) return [];

  // Flat word list
  const wordList =
    raw.words || raw.tokens || raw.detections || raw.recognitions;
  if (Array.isArray(wordList)) {
    return extractWordsFromArray(wordList);
  }

  // Nested in results / pages
  const results = raw.results || raw.pages || raw.outputs || raw.data;
  if (Array.isArray(results)) {
    return results.flatMap((r) => {
      if (!isRecord(r)) return [];
      const words =
        r.words || r.tokens || r.detections || r.recognitions;
      return Array.isArray(words) ? extractWordsFromArray(words) : [];
    });
  }

  return [];
}

function buildPagesFromRaw(raw: unknown): NvidiaOcrPage[] {
  if (!isRecord(raw)) return [];

  const results = raw.results || raw.pages || raw.outputs || raw.data;
  if (!Array.isArray(results) || results.length === 0) {
    // Single-page response — synthesize a page from the top-level data
    const text = extractFullText(raw);
    const words = extractWords(raw);
    if (!text && words.length === 0) return [];
    return [
      {
        pageIndex: 0,
        text: text || words.map((w) => w.text).join(" "),
        words,
      },
    ];
  }

  return results.map((r, idx) => {
    const pageText = isRecord(r)
      ? safeString(r.text || r.content || r.output || r.recognized_text)
      : typeof r === "string"
        ? r
        : "";

    const pageWords = isRecord(r)
      ? extractWordsFromArray(
          Array.isArray(r.words || r.tokens || r.detections) 
            ? ((r.words || r.tokens || r.detections) as unknown[])
            : []
        )
      : [];

    return {
      pageIndex: idx,
      text: pageText || pageWords.map((w) => w.text).join(" "),
      words: pageWords,
    };
  });
}

function computeAverageConfidence(words: NvidiaOcrWord[]): number {
  if (words.length === 0) return 1.0;
  const sum = words.reduce((acc, w) => acc + w.confidence, 0);
  return sum / words.length;
}

/**
 * Normalizes any raw response from the Nemotron OCR v2 NIM endpoint into
 * a clean, structured `NvidiaOcrResult`.
 */
export function normalizeNvidiaOcrResponse(
  raw: unknown,
  model: string
): NvidiaOcrResult {
  const pages = buildPagesFromRaw(raw);
  const allWords = pages.flatMap((p) => p.words);

  // Prefer a top-level full text field; fall back to joining page texts
  const topLevelText = extractFullText(raw);
  const joinedText = pages.map((p) => p.text).join("\n").trim();
  const text = topLevelText || joinedText;

  return {
    provider: "nvidia",
    model,
    text,
    pages,
    words: allWords,
    averageConfidence: computeAverageConfidence(allWords),
    raw,
  };
}

// ─────────────────────────────────────────────
// Main entry point
// ─────────────────────────────────────────────

/**
 * Runs NVIDIA Nemotron OCR v2 on a base64-encoded image and returns
 * structured text extraction results.
 *
 * @example
 * ```ts
 * const result = await submitNvidiaOcr({
 *   imageBase64: fs.readFileSync("receipt.png").toString("base64"),
 *   mimeType: "image/png",
 * });
 * console.log(result.text); // extracted text
 * ```
 */
export async function submitNvidiaOcr(
  input: NvidiaOcrInput
): Promise<NvidiaOcrResult> {
  const config = resolveNvidiaOcrConfig(input.model);

  const headers: Record<string, string> = {
    accept: "application/json",
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  const body = buildOcrRequestBody(input, config.model);

  const response = await fetch(config.inferUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      await parseProviderErrorResponse(response, "NVIDIA Nemotron OCR v2")
    );
  }

  const raw: unknown = await response.json();
  const result = normalizeNvidiaOcrResponse(raw, config.model);

  if (!result.text && result.words.length === 0) {
    throw new Error(
      "NVIDIA Nemotron OCR v2 did not return any recognized text."
    );
  }

  return result;
}
