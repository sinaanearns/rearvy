export type MarkdownTableAlignment = "left" | "center" | "right";

export type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[]; start: number }
  | {
      type: "table";
      headers: string[];
      rows: string[][];
      alignments: MarkdownTableAlignment[];
    }
  | { type: "blockquote"; content: string }
  | { type: "claude-cards"; configText: string }
  | { type: "interactive-explainer"; configText: string }
  | { type: "trade-chart"; configText: string }
  | { type: "code"; language: string | null; content: string }
  | { type: "prompt"; content: string }
  | { type: "divider" };

const CLAUDE_CARDS_LANGUAGES = new Set(["claude-cards", "claude-card", "cards"]);
const INTERACTIVE_EXPLAINER_LANGUAGES = new Set(["interactive", "interactive-explainer"]);
const TRADE_CHART_LANGUAGES = new Set([
  "trade-chart",
  "trade-signal-chart",
  "signal-chart",
]);

function normalizeFenceLanguage(language: string | null): string | null {
  if (!language) return null;

  const normalized = language.trim().toLowerCase().split(/\s+/)[0] ?? "";
  return normalized || null;
}

function isDividerLine(line: string): boolean {
  const compactLine = line.replace(/[ \t]/g, "");

  return (
    /^-{3,}$/.test(compactLine) ||
    /^\*{3,}$/.test(compactLine) ||
    /^_{3,}$/.test(compactLine)
  );
}

function isBlockStart(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*+]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    isDividerLine(line)
  );
}

function isMarkdownTableStart(line: string, nextLine: string | undefined): boolean {
  return Boolean(
    nextLine &&
      line.includes("|") &&
      parseMarkdownTableAlignments(nextLine.trim())
  );
}

function isListContinuationLine(
  rawLine: string,
  line: string,
  nextLine: string | undefined
): boolean {
  return (
    /^\s+\S/.test(rawLine) &&
    !isBlockStart(line) &&
    !isMarkdownTableStart(line, nextLine)
  );
}

function appendListContinuation(items: string[], continuation: string) {
  const previousIndex = items.length - 1;

  if (previousIndex < 0) {
    return;
  }

  items[previousIndex] = `${items[previousIndex]} ${continuation}`;
}

export function parseMarkdownBlocks(content: string): MarkdownBlock[] {
  const lines = content.replace(/\r/g, "").split("\n");
  const blocks: MarkdownBlock[] = [];

  let index = 0;

  while (index < lines.length) {
    const rawLine = lines[index];
    const line = rawLine.trim();

    if (!line) {
      index += 1;
      continue;
    }

    if (line.startsWith("```")) {
      const language = normalizeFenceLanguage(line.slice(3).trim() || null);
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      const configText = codeLines.join("\n");

      if (language && CLAUDE_CARDS_LANGUAGES.has(language)) {
        blocks.push({
          type: "claude-cards",
          configText,
        });
        continue;
      }

      if (language && INTERACTIVE_EXPLAINER_LANGUAGES.has(language)) {
        blocks.push({
          type: "interactive-explainer",
          configText,
        });
        continue;
      }

      if (language && TRADE_CHART_LANGUAGES.has(language)) {
        blocks.push({
          type: "trade-chart",
          configText,
        });
        continue;
      }

      blocks.push({
        type: "code",
        language,
        content: configText,
      });
      continue;
    }

    if (isMarkdownTableStart(line, lines[index + 1])) {
      const headers = parseTableRow(line);
      const alignments = parseMarkdownTableAlignments(lines[index + 1].trim()) ?? [];
      index += 2;

      const rows: string[][] = [];
      while (index < lines.length) {
        const nextLine = lines[index].trim();

        if (!nextLine || !nextLine.includes("|")) {
          break;
        }

        rows.push(parseTableRow(nextLine));
        index += 1;
      }

      blocks.push({ type: "table", headers, rows, alignments });
      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      blocks.push({
        type: "heading",
        level: headingMatch[1].length,
        content: headingMatch[2],
      });
      index += 1;
      continue;
    }

    if (isDividerLine(line)) {
      blocks.push({ type: "divider" });
      index += 1;
      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines: string[] = [];

      while (index < lines.length) {
        const nextLine = lines[index].trim();
        const quoteMatch = nextLine.match(/^>\s?(.*)$/);

        if (!quoteMatch) {
          break;
        }

        quoteLines.push(quoteMatch[1]);
        index += 1;
      }

      blocks.push({
        type: "blockquote",
        content: quoteLines.join(" "),
      });
      continue;
    }

    if (/^[-*+]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const rawNextLine = lines[index];
        const nextLine = rawNextLine.trim();

        if (!nextLine) {
          break;
        }

        const itemMatch = nextLine.match(/^[-*+]\s+(.*)$/);
        if (itemMatch) {
          items.push(itemMatch[1]);
          index += 1;
          continue;
        }

        if (isListContinuationLine(rawNextLine, nextLine, lines[index + 1])) {
          appendListContinuation(items, nextLine);
          index += 1;
          continue;
        }

        break;
      }

      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];
      const firstItemMatch = line.match(/^(\d+)\.\s+(.*)$/);
      const start = firstItemMatch ? Number.parseInt(firstItemMatch[1], 10) : 1;

      while (index < lines.length) {
        const rawNextLine = lines[index];
        const nextLine = rawNextLine.trim();

        if (!nextLine) {
          break;
        }

        const itemMatch = nextLine.match(/^\d+\.\s+(.*)$/);

        if (itemMatch) {
          items.push(itemMatch[1]);
          index += 1;
          continue;
        }

        if (isListContinuationLine(rawNextLine, nextLine, lines[index + 1])) {
          appendListContinuation(items, nextLine);
          index += 1;
          continue;
        }

        break;
      }

      blocks.push({ type: "ordered-list", items, start });
      continue;
    }

    const promptHeaderRegex = /^Direct prompt for your AI chat implementation:?$/i;
    if (promptHeaderRegex.test(line)) {
      blocks.push({
        type: "paragraph",
        content: line,
      });
      index += 1;

      if (index < lines.length && lines[index].trim().startsWith("```")) {
        const promptLines: string[] = [];
        index += 1;

        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          promptLines.push(lines[index]);
          index += 1;
        }

        if (index < lines.length) {
          index += 1;
        }

        blocks.push({
          type: "prompt",
          content: promptLines.join("\n"),
        });
        continue;
      }
      continue;
    }

    const paragraphLines: string[] = [line];
    index += 1;

    while (index < lines.length) {
      const nextLine = lines[index].trim();

      if (!nextLine) {
        index += 1;
        break;
      }

      if (isBlockStart(nextLine) || isMarkdownTableStart(nextLine, lines[index + 1])) {
        break;
      }

      paragraphLines.push(nextLine);
      index += 1;
    }

    blocks.push({
      type: "paragraph",
      content: paragraphLines.join(" "),
    });
  }

  return blocks;
}

function parseMarkdownTableAlignments(
  line: string
): MarkdownTableAlignment[] | null {
  if (!line.includes("-")) return null;

  const segments = parseTableRow(line);

  if (segments.length < 2) return null;

  const alignments: MarkdownTableAlignment[] = [];

  for (const segment of segments) {
    if (!/^:?-{3,}:?$/.test(segment)) {
      return null;
    }

    if (segment.startsWith(":") && segment.endsWith(":")) {
      alignments.push("center");
    } else if (segment.endsWith(":")) {
      alignments.push("right");
    } else {
      alignments.push("left");
    }
  }

  return alignments;
}

function hasEscapedCharacterAt(value: string, index: number): boolean {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function trimOuterTablePipes(line: string): string {
  let value = line.trim();

  if (value.startsWith("|")) {
    value = value.slice(1);
  }

  if (value.endsWith("|") && !hasEscapedCharacterAt(value, value.length - 1)) {
    value = value.slice(0, -1);
  }

  return value;
}

function parseTableRow(line: string): string[] {
  const cells: string[] = [];
  const value = trimOuterTablePipes(line);
  let currentCell = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (character !== "|") {
      currentCell += character;
      continue;
    }

    if (hasEscapedCharacterAt(value, index)) {
      currentCell = `${currentCell.slice(0, -1)}|`;
      continue;
    }

    cells.push(currentCell.trim());
    currentCell = "";
  }

  cells.push(currentCell.trim());

  return cells;
}

function unwrapTextPartArray(raw: string): string | null {
  const trimmed = raw.trim();

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      return null;
    }

    const textParts = parsed
      .map((part) => {
        if (
          part &&
          typeof part === "object" &&
          "type" in part &&
          "text" in part &&
          part.type === "text" &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return null;
      })
      .filter((text): text is string => text !== null);

    if (textParts.length === 0) {
      return null;
    }

    return textParts.join("");
  } catch {
    return null;
  }
}

function splitMarkdownLinesPreservingFenceEscapes(content: string): string[] {
  const lines: string[] = [];
  let currentLine = "";
  let inFence = false;
  let index = 0;

  const pushLine = () => {
    const isFenceLine = currentLine.trimStart().startsWith("```");
    lines.push(currentLine);
    currentLine = "";

    if (isFenceLine) {
      inFence = !inFence;
    }
  };

  while (index < content.length) {
    const character = content[index];

    if (character === "\r") {
      index += 1;
      continue;
    }

    if (character === "\n") {
      pushLine();
      index += 1;
      continue;
    }

    if (content.startsWith("\\n", index)) {
      const nextText = content.slice(index + 2).trimStart();
      const isFenceBoundary =
        !inFence ||
        currentLine.trimStart().startsWith("```") ||
        nextText.startsWith("```");

      if (isFenceBoundary) {
        pushLine();
        index += 2;
        continue;
      }
    }

    currentLine += character;
    index += 1;
  }

  lines.push(currentLine);

  return lines;
}

function decodeLiteralWhitespaceOutsideFences(content: string): string {
  const decodeWhitespace = (value: string) => value.replace(/\\t/g, "\t");

  const lines = splitMarkdownLinesPreservingFenceEscapes(content);
  let inFence = false;

  return lines
    .map((line) => {
      const isFenceLine = line.trimStart().startsWith("```");

      if (isFenceLine) {
        inFence = !inFence;
        return line;
      }

      return inFence ? line : decodeWhitespace(line);
    })
    .join("\n");
}

function collapseExtraNewlinesOutsideFences(content: string): string {
  const lines = content.split("\n");
  const collapsedLines: string[] = [];
  let inFence = false;
  let outsideBlankLineCount = 0;

  for (const line of lines) {
    const isFenceLine = line.trimStart().startsWith("```");

    if (isFenceLine) {
      collapsedLines.push(line);
      inFence = !inFence;
      outsideBlankLineCount = 0;
      continue;
    }

    if (!inFence && line.trim() === "") {
      outsideBlankLineCount += 1;

      if (outsideBlankLineCount <= 1) {
        collapsedLines.push(line);
      }

      continue;
    }

    collapsedLines.push(line);

    if (!inFence) {
      outsideBlankLineCount = 0;
    }
  }

  return collapsedLines.join("\n");
}

/**
 * Pre-process content before markdown parsing to handle edge cases where stored
 * chat parts may arrive as escaped text or as a serialized text-part array.
 */
export function preProcessMarkdownContent(raw: string): string {
  let content = unwrapTextPartArray(raw) ?? raw;

  content = decodeLiteralWhitespaceOutsideFences(content);
  content = collapseExtraNewlinesOutsideFences(content);

  return content.trim();
}
