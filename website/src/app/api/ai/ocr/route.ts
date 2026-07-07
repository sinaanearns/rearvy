import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";
import {
  hasNvidiaOcrConfig,
  getNvidiaOcrConfigError,
  submitNvidiaOcr,
  type NvidiaOcrMimeType,
} from "@/lib/ai/nvidia-ocr";
import { ingestDocument } from "@/lib/knowledge/ingestion-pipeline";

export const runtime = "nodejs";

const log = createServerLogger("OcrApi");

// ─────────────────────────────────────────────
// Allowed image MIME types
// ─────────────────────────────────────────────

const ALLOWED_IMAGE_MIME_TYPES: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/tiff",
]);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024; // 20 MB

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalBool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

/**
 * Extracts a base64 string from either a raw base64 string or a data URL.
 * Returns null if the input is not a recognizable base64 image payload.
 */
function extractBase64(value: string): { base64: string; mimeType: string } | null {
  const dataUrlMatch = value.match(/^data:(image\/[^;]+);base64,([\s\S]+)$/);
  if (dataUrlMatch) {
    return { mimeType: dataUrlMatch[1], base64: dataUrlMatch[2] };
  }

  // Loose check: if it looks like raw base64 (alphanum + /+=) treat it as-is
  const stripped = value.replace(/\s/g, "");
  if (/^[A-Za-z0-9+/]+=*$/.test(stripped) && stripped.length > 64) {
    return { mimeType: "image/png", base64: stripped };
  }

  return null;
}

/**
 * Validates the MIME type and returns it if allowed, or an error string.
 */
function validateMimeType(
  mimeType: string
): NvidiaOcrMimeType | { error: string } {
  const normalized = mimeType.toLowerCase().trim();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(normalized)) {
    return {
      error: `Unsupported image type: ${mimeType}. Allowed: ${[...ALLOWED_IMAGE_MIME_TYPES].join(", ")}.`,
    };
  }
  return normalized as NvidiaOcrMimeType;
}

// ─────────────────────────────────────────────
// Route handler
// ─────────────────────────────────────────────

/**
 * POST /api/ai/ocr
 *
 * Accepts either:
 *   A) multipart/form-data  — field "file" (image), optional "model", "title", "ingestToKnowledge"
 *   B) application/json     — { image: "<base64|data-url>", mimeType?, model?, title?, ingestToKnowledge? }
 *
 * Returns:
 *   { provider, model, text, words, pages, averageConfidence, documentId? }
 *
 * When ingestToKnowledge=true the extracted text is automatically ingested
 * into the user's RAG knowledge base and the Firestore document ID is returned.
 */
export async function POST(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;
  const userId = auth.user!.uid;

  // ── Check OCR is configured ───────────────────────────────────────────────
  if (!hasNvidiaOcrConfig()) {
    return NextResponse.json(
      { error: getNvidiaOcrConfigError() },
      { status: 503 }
    );
  }

  try {
    let imageBase64: string;
    let mimeType: NvidiaOcrMimeType = "image/png";
    let model: string | undefined;
    let title: string | undefined;
    let ingestToKnowledge: boolean = false;

    const contentType = request.headers.get("content-type") ?? "";

    // ── Parse request ────────────────────────────────────────────────────────
    if (contentType.includes("multipart/form-data")) {
      // ── multipart/form-data upload ─────────────────────────────────────
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { error: "No file provided. Include an image as the 'file' form field." },
          { status: 400 }
        );
      }

      if (file.size > MAX_IMAGE_BYTES) {
        return NextResponse.json(
          { error: `Image exceeds the 20 MB size limit (received ${file.size} bytes).` },
          { status: 400 }
        );
      }

      const validatedMime = validateMimeType(file.type || "image/png");
      if (typeof validatedMime === "object") {
        return NextResponse.json({ error: validatedMime.error }, { status: 400 });
      }

      mimeType = validatedMime;
      model = optionalString(formData.get("model"));
      title = optionalString(formData.get("title")) ?? file.name ?? "Uploaded image";
      ingestToKnowledge = optionalBool(formData.get("ingestToKnowledge"), false);

      const arrayBuffer = await file.arrayBuffer();
      imageBase64 = Buffer.from(arrayBuffer).toString("base64");
    } else {
      // ── JSON body ─────────────────────────────────────────────────────────
      let body: Record<string, unknown>;
      try {
        body = await request.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body." },
          { status: 400 }
        );
      }

      const rawImage = optionalString(body.image);
      if (!rawImage) {
        return NextResponse.json(
          {
            error:
              "Missing required field: 'image' (base64 string or data URL). " +
              "Alternatively send a multipart/form-data request with a 'file' field.",
          },
          { status: 400 }
        );
      }

      const extracted = extractBase64(rawImage);
      if (!extracted) {
        return NextResponse.json(
          { error: "Could not parse 'image' as a valid base64 string or data URL." },
          { status: 400 }
        );
      }

      const explicitMime = optionalString(body.mimeType) ?? extracted.mimeType;
      const validatedMime = validateMimeType(explicitMime);
      if (typeof validatedMime === "object") {
        return NextResponse.json({ error: validatedMime.error }, { status: 400 });
      }

      imageBase64 = extracted.base64;
      mimeType = validatedMime;
      model = optionalString(body.model);
      title = optionalString(body.title) ?? "OCR image";
      ingestToKnowledge = optionalBool(body.ingestToKnowledge, false);
    }

    // Validate decoded size (base64 → ~75% of original byte size)
    const estimatedBytes = Math.ceil((imageBase64.length * 3) / 4);
    if (estimatedBytes > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        { error: `Image exceeds the 20 MB size limit (estimated ${estimatedBytes} bytes).` },
        { status: 400 }
      );
    }

    log.info(
      `OCR request: mimeType=${mimeType}, estimatedBytes=${estimatedBytes}, ` +
        `model=${model ?? "default"}, ingest=${ingestToKnowledge}, userId=${userId}`
    );

    // ── Run OCR ──────────────────────────────────────────────────────────────
    const result = await submitNvidiaOcr({ imageBase64, mimeType, model });

    log.info(
      `OCR completed: ${result.words.length} words, ` +
        `confidence=${result.averageConfidence.toFixed(3)}, model=${result.model}`
    );

    // ── Optional RAG ingestion ───────────────────────────────────────────────
    let documentId: string | undefined;
    if (ingestToKnowledge && result.text) {
      try {
        documentId = await ingestDocument({
          userId,
          title: title ?? "OCR extracted text",
          sourceType: "file",
          sourceIdentifier: `ocr:${result.model}:${Date.now()}`,
          text: result.text,
          mimeType,
        });
        log.info(`OCR text ingested into knowledge base: documentId=${documentId}`);
      } catch (ingestError) {
        // Non-fatal: log the error but still return the OCR result
        log.error("Failed to ingest OCR text into knowledge base:", ingestError);
      }
    }

    // ── Response ─────────────────────────────────────────────────────────────
    return NextResponse.json({
      provider: result.provider,
      model: result.model,
      text: result.text,
      words: result.words,
      pages: result.pages,
      averageConfidence: result.averageConfidence,
      ...(documentId ? { documentId } : {}),
    });
  } catch (err) {
    log.error("OCR error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : "An unexpected error occurred during OCR processing.",
      },
      { status: 500 }
    );
  }
}
