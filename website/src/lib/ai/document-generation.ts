import {
  AlignmentType,
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from "docx";
import {
  PDFDocument,
  StandardFonts,
  rgb,
  type PDFFont,
  type PDFPage,
} from "pdf-lib";

export const GENERATED_DOCUMENT_FORMATS = [
  "pdf",
  "docx",
  "markdown",
  "txt",
  "html",
] as const;

export type GeneratedDocumentFormat = (typeof GENERATED_DOCUMENT_FORMATS)[number];

export type GeneratedDocumentFile = {
  format: GeneratedDocumentFormat;
  label: string;
  fileName: string;
  mimeType: string;
  base64: string;
  sizeBytes: number;
};

export type GeneratedDocumentSuccess = {
  ok: true;
  title: string;
  summary: string;
  markdown: string;
  formats: GeneratedDocumentFormat[];
  files: GeneratedDocumentFile[];
  message: string;
  modelRoute?: unknown;
};

export type GeneratedDocumentError = {
  ok: false;
  title?: string;
  message: string;
  errorCode?: string;
};

export type GeneratedDocumentToolResult =
  | GeneratedDocumentSuccess
  | GeneratedDocumentError;

export type DocumentGenerationToolInput = {
  brief: string;
  formats?: GeneratedDocumentFormat[];
  title?: string;
  documentType?: string;
  audience?: string;
  tone?: string;
};

type ParsedMarkdownBlock =
  | {
      type: "heading";
      level: 1 | 2 | 3;
      text: string;
    }
  | {
      type: "paragraph";
      text: string;
    }
  | {
      type: "bullet";
      text: string;
    }
  | {
      type: "numbered";
      number: number;
      text: string;
    };

const FORMAT_LABELS: Record<GeneratedDocumentFormat, string> = {
  pdf: "PDF",
  docx: "Word document",
  markdown: "Markdown",
  txt: "Text",
  html: "HTML",
};

const FORMAT_EXTENSIONS: Record<GeneratedDocumentFormat, string> = {
  pdf: "pdf",
  docx: "docx",
  markdown: "md",
  txt: "txt",
  html: "html",
};

const FORMAT_MIME_TYPES: Record<GeneratedDocumentFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  markdown: "text/markdown;charset=utf-8",
  txt: "text/plain;charset=utf-8",
  html: "text/html;charset=utf-8",
};

function uniqueFormats(formats: GeneratedDocumentFormat[]) {
  const seen = new Set<GeneratedDocumentFormat>();
  const result: GeneratedDocumentFormat[] = [];

  for (const format of formats) {
    if (!seen.has(format)) {
      seen.add(format);
      result.push(format);
    }
  }

  return result;
}

export function normalizeDocumentFormats(
  formats: readonly unknown[] | null | undefined
): GeneratedDocumentFormat[] {
  const requested = Array.isArray(formats)
    ? formats.filter((format): format is GeneratedDocumentFormat =>
        GENERATED_DOCUMENT_FORMATS.includes(format as GeneratedDocumentFormat)
      )
    : [];

  return uniqueFormats(requested.length > 0 ? requested : ["pdf", "docx"]);
}

function cleanInlineMarkdown(value: string) {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .trim();
}

export function normalizeGeneratedDocumentMarkdown(
  value: string,
  fallbackTitle: string
) {
  const cleaned = value
    .replace(/```(?:markdown|md)?/gi, "")
    .replace(/```/g, "")
    .replace(/\r\n/g, "\n")
    .trim();

  if (/^#\s+/m.test(cleaned)) {
    return cleaned.slice(0, 40_000);
  }

  return `# ${fallbackTitle}\n\n${cleaned}`.trim().slice(0, 40_000);
}

export function extractTitleFromMarkdown(markdown: string, fallback: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1];
  const candidate = cleanInlineMarkdown(heading || fallback || "Generated Document")
    .replace(/[#:*_`]/g, "")
    .trim();

  return candidate.slice(0, 120) || "Generated Document";
}

export function createDocumentSummary(markdown: string) {
  const firstParagraph = parseMarkdownBlocks(markdown).find(
    (block) => block.type === "paragraph" && block.text.length > 0
  );

  if (!firstParagraph) {
    return "Document generated from your request.";
  }

  return firstParagraph.text.replace(/\s+/g, " ").slice(0, 180);
}

function parseMarkdownBlocks(markdown: string): ParsedMarkdownBlock[] {
  const blocks: ParsedMarkdownBlock[] = [];
  const paragraphLines: string[] = [];

  const flushParagraph = () => {
    if (paragraphLines.length === 0) {
      return;
    }

    blocks.push({
      type: "paragraph",
      text: cleanInlineMarkdown(paragraphLines.join(" ")),
    });
    paragraphLines.length = 0;
  };

  for (const rawLine of markdown.replace(/\r\n/g, "\n").split("\n")) {
    const line = rawLine.trim();

    if (!line) {
      flushParagraph();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: "heading",
        level: Math.min(heading[1].length, 3) as 1 | 2 | 3,
        text: cleanInlineMarkdown(heading[2]),
      });
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      blocks.push({ type: "bullet", text: cleanInlineMarkdown(bullet[1]) });
      continue;
    }

    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      blocks.push({
        type: "numbered",
        number: Number.parseInt(numbered[1], 10),
        text: cleanInlineMarkdown(numbered[2]),
      });
      continue;
    }

    if (/^\|.+\|$/.test(line)) {
      flushParagraph();
      blocks.push({
        type: "paragraph",
        text: cleanInlineMarkdown(line.replace(/\|/g, "  ")),
      });
      continue;
    }

    paragraphLines.push(line);
  }

  flushParagraph();
  return blocks;
}

function sanitizeFileBaseName(value: string) {
  const slug = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
    .replace(/-+$/g, "");

  return slug || "rearvy-document";
}

function textToBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function bytesToBase64(value: Uint8Array | Buffer) {
  return Buffer.from(value).toString("base64");
}

function buildFile(
  format: GeneratedDocumentFormat,
  title: string,
  bytes: Uint8Array | Buffer | string
): GeneratedDocumentFile {
  const rawBytes = typeof bytes === "string" ? Buffer.from(bytes, "utf8") : bytes;

  return {
    format,
    label: FORMAT_LABELS[format],
    fileName: `${sanitizeFileBaseName(title)}.${FORMAT_EXTENSIONS[format]}`,
    mimeType: FORMAT_MIME_TYPES[format],
    base64: typeof bytes === "string" ? textToBase64(bytes) : bytesToBase64(bytes),
    sizeBytes: rawBytes.byteLength,
  };
}

function blocksToPlainText(blocks: ParsedMarkdownBlock[]) {
  const lines: string[] = [];
  let previousWasListItem = false;

  for (const block of blocks) {
    const isListItem = block.type === "bullet" || block.type === "numbered";
    if (lines.length > 0 && (!previousWasListItem || !isListItem)) {
      lines.push("");
    }

    if (block.type === "heading" || block.type === "paragraph") {
      lines.push(block.text);
    } else if (block.type === "bullet") {
      lines.push(`- ${block.text}`);
    } else {
      lines.push(`${block.number}. ${block.text}`);
    }

    previousWasListItem = isListItem;
  }

  return lines.join("\n").trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function blocksToHtml(title: string, blocks: ParsedMarkdownBlock[]) {
  const htmlBlocks: string[] = [];

  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];

    if (block.type === "heading") {
      const tag = `h${block.level}`;
      htmlBlocks.push(`<${tag}>${escapeHtml(block.text)}</${tag}>`);
      continue;
    }

    if (block.type === "paragraph") {
      htmlBlocks.push(`<p>${escapeHtml(block.text)}</p>`);
      continue;
    }

    if (block.type === "bullet") {
      const items: string[] = [];
      while (true) {
        const item = blocks[index];
        if (item?.type !== "bullet") {
          break;
        }

        items.push(`<li>${escapeHtml(item.text)}</li>`);
        index += 1;
      }
      index -= 1;
      htmlBlocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }

    const items: string[] = [];
    const start = block.number;
    while (true) {
      const numberedBlock = blocks[index];
      if (numberedBlock?.type !== "numbered") {
        break;
      }

      items.push(
        `<li value="${numberedBlock.number}">${escapeHtml(numberedBlock.text)}</li>`
      );
      index += 1;
    }
    index -= 1;
    htmlBlocks.push(`<ol start="${start}">${items.join("")}</ol>`);
  }

  const body = htmlBlocks.join("\n");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { color: #111827; font-family: Arial, sans-serif; line-height: 1.6; margin: 40px; max-width: 840px; }
    h1 { font-size: 30px; line-height: 1.2; margin: 0 0 20px; }
    h2 { font-size: 20px; margin: 28px 0 10px; }
    h3 { font-size: 16px; margin: 22px 0 8px; }
    p { margin: 0 0 14px; }
    ul, ol { margin: 0 0 12px 24px; padding: 0; }
    li { margin: 0 0 6px; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

function createDocxParagraphs(blocks: ParsedMarkdownBlock[]) {
  return blocks.map((block) => {
    if (block.type === "heading") {
      const heading =
        block.level === 1
          ? HeadingLevel.TITLE
          : block.level === 2
            ? HeadingLevel.HEADING_2
            : HeadingLevel.HEADING_3;

      return new Paragraph({
        heading,
        spacing: { before: block.level === 1 ? 0 : 300, after: 160 },
        children: [
          new TextRun({
            text: block.text,
            bold: block.level !== 3,
          }),
        ],
      });
    }

    if (block.type === "bullet") {
      return new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 120 },
        children: [new TextRun({ text: block.text })],
      });
    }

    if (block.type === "numbered") {
      return new Paragraph({
        spacing: { after: 120 },
        children: [new TextRun({ text: block.text })],
        numbering: { reference: "rearvy-numbering", level: 0 },
      });
    }

    return new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 180, line: 320 },
      children: [new TextRun({ text: block.text })],
    });
  });
}

async function createDocxBytes(title: string, blocks: ParsedMarkdownBlock[]) {
  const document = new Document({
    creator: "Rearvy",
    title,
    description: "AI-generated document created in Rearvy.",
    numbering: {
      config: [
        {
          reference: "rearvy-numbering",
          levels: [
            {
              level: 0,
              format: "decimal",
              text: "%1.",
              alignment: AlignmentType.LEFT,
              style: {
                paragraph: {
                  indent: { left: 720, hanging: 360 },
                },
              },
            },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1080,
              right: 1080,
              bottom: 1080,
              left: 1080,
            },
          },
        },
        children: createDocxParagraphs(blocks),
      },
    ],
  });

  return Packer.toBuffer(document);
}

function sanitizePdfText(value: string) {
  return value
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/[^\x09\x0a\x0d\x20-\x7e]/g, "")
    .trim();
}

function wrapPdfText(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = sanitizePdfText(text).split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";

  const pushLongWord = (word: string) => {
    let remaining = word;
    while (remaining) {
      let chunk = "";
      for (const char of remaining) {
        if (font.widthOfTextAtSize(`${chunk}${char}`, size) > maxWidth && chunk) {
          break;
        }
        chunk += char;
      }
      lines.push(chunk || remaining.slice(0, 1));
      remaining = remaining.slice((chunk || remaining.slice(0, 1)).length);
    }
  };

  for (const word of words) {
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }
      pushLongWord(word);
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      current = candidate;
    } else {
      if (current) {
        lines.push(current);
      }
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }

  return lines.length > 0 ? lines : [""];
}

async function createPdfBytes(title: string, blocks: ParsedMarkdownBlock[]) {
  const pdf = await PDFDocument.create();
  const regularFont = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 54;
  const bottomMargin = 54;
  let page: PDFPage = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const addPage = () => {
    page = pdf.addPage(pageSize);
    y = pageSize[1] - margin;
  };

  const ensureSpace = (height: number) => {
    if (y - height < bottomMargin) {
      addPage();
    }
  };

  const drawWrapped = (params: {
    text: string;
    font: PDFFont;
    size: number;
    lineHeight: number;
    indent?: number;
    color?: ReturnType<typeof rgb>;
    after?: number;
  }) => {
    const indent = params.indent ?? 0;
    const lines = wrapPdfText(
      params.text,
      params.font,
      params.size,
      pageSize[0] - margin * 2 - indent
    );

    for (const line of lines) {
      ensureSpace(params.lineHeight);
      page.drawText(line, {
        x: margin + indent,
        y,
        size: params.size,
        font: params.font,
        color: params.color ?? rgb(0.12, 0.14, 0.18),
      });
      y -= params.lineHeight;
    }

    y -= params.after ?? 6;
  };

  pdf.setTitle(title);
  pdf.setAuthor("Rearvy");
  pdf.setSubject("AI-generated document");
  pdf.setCreationDate(new Date());

  for (const block of blocks) {
    if (block.type === "heading") {
      const size = block.level === 1 ? 24 : block.level === 2 ? 15 : 12;
      const lineHeight = block.level === 1 ? 29 : block.level === 2 ? 20 : 17;
      ensureSpace(lineHeight + 8);
      drawWrapped({
        text: block.text,
        font: boldFont,
        size,
        lineHeight,
        color: rgb(0.05, 0.09, 0.16),
        after: block.level === 1 ? 18 : 8,
      });
      if (block.level === 1) {
        ensureSpace(10);
        page.drawLine({
          start: { x: margin, y: y + 6 },
          end: { x: pageSize[0] - margin, y: y + 6 },
          thickness: 1,
          color: rgb(0.82, 0.86, 0.91),
        });
        y -= 8;
      }
      continue;
    }

    if (block.type === "bullet") {
      drawWrapped({
        text: `- ${block.text}`,
        font: regularFont,
        size: 10.5,
        lineHeight: 15,
        indent: 14,
        after: 3,
      });
      continue;
    }

    if (block.type === "numbered") {
      drawWrapped({
        text: `${block.number}. ${block.text}`,
        font: regularFont,
        size: 10.5,
        lineHeight: 15,
        indent: 14,
        after: 3,
      });
      continue;
    }

    drawWrapped({
      text: block.text,
      font: regularFont,
      size: 10.5,
      lineHeight: 16,
      after: 8,
    });
  }

  return pdf.save();
}

export async function createGeneratedDocumentFiles(params: {
  title: string;
  markdown: string;
  formats: readonly GeneratedDocumentFormat[];
}): Promise<GeneratedDocumentFile[]> {
  const formats = normalizeDocumentFormats(params.formats);
  const blocks = parseMarkdownBlocks(params.markdown);
  const title = extractTitleFromMarkdown(params.markdown, params.title);
  const safeMarkdown = params.markdown.trim();
  const files: GeneratedDocumentFile[] = [];

  for (const format of formats) {
    if (format === "pdf") {
      files.push(buildFile(format, title, await createPdfBytes(title, blocks)));
      continue;
    }

    if (format === "docx") {
      files.push(buildFile(format, title, await createDocxBytes(title, blocks)));
      continue;
    }

    if (format === "markdown") {
      files.push(buildFile(format, title, safeMarkdown));
      continue;
    }

    if (format === "txt") {
      files.push(buildFile(format, title, blocksToPlainText(blocks)));
      continue;
    }

    files.push(buildFile(format, title, blocksToHtml(title, blocks)));
  }

  return files;
}
