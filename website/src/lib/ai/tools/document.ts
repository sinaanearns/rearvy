import { tool } from "ai";
import { z } from "zod";

import {
  analyzeGeneratedDocumentIntegrity,
  createDocumentSummary,
  createGeneratedDocumentFiles,
  extractTitleFromMarkdown,
  GENERATED_DOCUMENT_FORMATS,
  normalizeDocumentFormats,
  normalizeGeneratedDocumentMarkdown,
  type DocumentGenerationToolInput,
  type GeneratedDocumentToolResult,
} from "@/lib/ai/document-generation";
import {
  aiCompletionService,
  sanitizeModelRouteForClient,
} from "@/lib/ai/model-router";
import { createServerLogger } from "@/lib/server-logger";
import type { ToolContext } from "../types";

const log = createServerLogger("DocumentTool");

const documentFormatSchema = z.enum(GENERATED_DOCUMENT_FORMATS);

function cleanTitle(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/[^\w\s.,:()'&-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

function buildDocumentSystemPrompt() {
  return [
    "You are Rearvy's professional document writer.",
    "Create polished business documents in Markdown that can be converted to PDF and Microsoft Word.",
    "Use only facts supplied in the brief, visible chat context, saved context, or tool results. Do not invent brand facts, product specs, pricing, deadlines, availability, metrics, testimonials, customer names, citations, market statistics, legal terms, medical claims, or financial claims.",
    "If a necessary detail is missing, either omit it or mark it with an explicit placeholder like [NEEDS: audience], [NEEDS: offer], [NEEDS: proof], or [NEEDS: source/current data].",
    "If you make assumptions to complete the draft, add a short 'Assumptions to review' section near the end.",
    "For creator content, make the draft directly usable: hooks, platform-ready copy, scripts, captions, CTAs, and editing notes when they fit the requested format.",
    "Return Markdown only. Do not wrap the answer in code fences.",
    "Start with a single # title.",
    "Use clear sections, concise paragraphs, bullets, and numbered steps when useful.",
    "Avoid markdown tables unless the user explicitly asks for a table.",
    "Do not mention that you cannot attach files; the system will package the document.",
  ].join("\n");
}

function buildDocumentPrompt(input: Required<DocumentGenerationToolInput>) {
  const presentationGuidance = /\b(?:presentation|slides?|deck)\b/i.test(input.documentType)
    ? "For this presentation request, structure the Markdown as slide-ready content: one section per slide, concise bullets, speaker notes where useful, and a clear opening and closing slide."
    : "";

  return `Create a ${input.documentType} from this brief:
${input.brief}

Requested file formats: ${input.formats.join(", ")}
Audience: ${input.audience || "professional business reader"}
Tone: ${input.tone || "clear, polished, practical"}
${input.title ? `Preferred title: ${input.title}` : ""}
${presentationGuidance}

Write the finished document content now. Keep unsupported facts out of the draft or mark them with [NEEDS: ...] placeholders.`;
}

export function generateDocument(ctx: ToolContext) {
  return tool({
    description:
      "Create downloadable business documents from a user brief. Use this when the user asks to make, create, draft, or export a PDF, Microsoft Word DOCX, markdown, text, HTML, report, proposal, memo, brief, one-pager, letter, invoice, contract, or resume.",
    inputSchema: z.object({
      brief: z
        .string()
        .min(1)
        .describe("The user's document brief. Preserve the requested topic, details, audience, and constraints."),
      formats: z
        .array(documentFormatSchema)
        .optional()
        .describe("Requested output formats. Use pdf and docx by default. Use all formats only when requested."),
      title: z.string().optional().describe("Optional document title."),
      documentType: z
        .string()
        .optional()
        .describe("Document category such as proposal, report, memo, brief, letter, invoice, contract, resume, or document."),
      audience: z.string().optional().describe("Optional target audience."),
      tone: z.string().optional().describe("Optional writing tone."),
    }),
    execute: async (rawInput): Promise<GeneratedDocumentToolResult> => {
      const formats = normalizeDocumentFormats(rawInput.formats);
      const title = cleanTitle(rawInput.title);
      const input: Required<DocumentGenerationToolInput> = {
        brief: rawInput.brief.trim(),
        formats,
        title,
        documentType: rawInput.documentType?.trim() || "document",
        audience: rawInput.audience?.trim() || "",
        tone: rawInput.tone?.trim() || "",
      };

      try {
        const result = await aiCompletionService.generateText({
          task: "deep_business_reasoning",
          requestedProviderModel:
            process.env.DOCUMENT_GENERATION_MODEL ||
            ctx.chatProviderModel ||
            undefined,
          system: buildDocumentSystemPrompt(),
          prompt: buildDocumentPrompt(input),
          userId: ctx.userId,
          projectId: ctx.projectId ?? null,
          chatId: ctx.chatId ?? null,
          maxOutputTokens: 3200,
          temperature: 0.45,
          timeoutMs: 60_000,
        });

        if (result.aiUnavailable) {
          return {
            ok: false,
            title: title || undefined,
            errorCode: "AI_UNAVAILABLE",
            message: result.text || "No configured AI provider is available for document generation.",
          };
        }

        const fallbackTitle =
          title || `${input.documentType[0]?.toUpperCase() || "D"}${input.documentType.slice(1)}`;
        const markdown = normalizeGeneratedDocumentMarkdown(
          result.text,
          fallbackTitle
        );
        const resolvedTitle = extractTitleFromMarkdown(markdown, fallbackTitle);
        const files = await createGeneratedDocumentFiles({
          title: resolvedTitle,
          markdown,
          formats,
        });

        return {
          ok: true,
          title: resolvedTitle,
          summary: createDocumentSummary(markdown),
          markdown,
          formats,
          files,
          contentIntegrity: analyzeGeneratedDocumentIntegrity(markdown),
          message: `Created ${files.length} downloadable document file${files.length === 1 ? "" : "s"}.`,
          modelRoute: sanitizeModelRouteForClient(result.modelRoute),
        };
      } catch (error) {
        log.error("Document generation failed:", error);
        return {
          ok: false,
          title: title || undefined,
          errorCode: "DOCUMENT_GENERATION_ERROR",
          message:
            error instanceof Error
              ? error.message
              : "Failed to generate the document.",
        };
      }
    },
  });
}
