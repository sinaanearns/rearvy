import {
  normalizeMarkdownHref,
  splitBareMarkdownUrlToken,
} from "../../lib/chat/markdown-links";

export type InlineMarkdownToken =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineMarkdownToken[] }
  | { type: "emphasis"; children: InlineMarkdownToken[] }
  | { type: "strikethrough"; children: InlineMarkdownToken[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: InlineMarkdownToken[] };

const INLINE_TOKEN_PATTERN =
  /(`[^`]+`|\*\*[^*]+\*\*|(?<![A-Za-z0-9])__[^_]+__(?![A-Za-z0-9])|~~[^~]+~~|\[[^\]]+\]\(([^)]+)\)|\*[^*]+\*|(?<![A-Za-z0-9])_[^_]+_(?![A-Za-z0-9])|<https?:\/\/[^\s<>"'`]+>|https?:\/\/[^\s<>"'`]+)/g;
const ESCAPED_INLINE_MARKDOWN_TEXT = /\\([\\`*_[\]{}()#+\-.!<>|~])/g;
const ESCAPABLE_TOKEN_OPENERS = new Set(["`", "*", "_", "~", "[", "<"]);

type MarkdownLinkMatch = {
  hrefText: string;
  label: string;
  raw: string;
};

function appendText(tokens: InlineMarkdownToken[], text: string) {
  if (!text) return;

  const decodedText = text.replace(ESCAPED_INLINE_MARKDOWN_TEXT, "$1");
  if (!decodedText) return;

  const previousToken = tokens[tokens.length - 1];
  if (previousToken?.type === "text") {
    previousToken.text += decodedText;
    return;
  }

  tokens.push({ type: "text", text: decodedText });
}

function hasEscapedCharacterAt(value: string, index: number): boolean {
  let slashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && value[cursor] === "\\"; cursor -= 1) {
    slashCount += 1;
  }

  return slashCount % 2 === 1;
}

function isEscapedInlineMarkdownToken(source: string, index: number): boolean {
  return ESCAPABLE_TOKEN_OPENERS.has(source[index]) && hasEscapedCharacterAt(source, index);
}

function parseMarkdownLinkAt(source: string, startIndex: number): MarkdownLinkMatch | null {
  if (source[startIndex] !== "[") {
    return null;
  }

  const labelEndIndex = source.indexOf("](", startIndex + 1);
  if (labelEndIndex === -1) {
    return null;
  }

  const hrefStartIndex = labelEndIndex + 2;
  let parenDepth = 0;

  for (let index = hrefStartIndex; index < source.length; index += 1) {
    const character = source[index];

    if (character === "(") {
      parenDepth += 1;
      continue;
    }

    if (character !== ")") {
      continue;
    }

    if (parenDepth > 0) {
      parenDepth -= 1;
      continue;
    }

    return {
      label: source.slice(startIndex + 1, labelEndIndex),
      hrefText: source.slice(hrefStartIndex, index),
      raw: source.slice(startIndex, index + 1),
    };
  }

  return null;
}

export function parseInlineMarkdownTokens(text: string): InlineMarkdownToken[] {
  const tokens: InlineMarkdownToken[] = [];
  const tokenPattern = new RegExp(INLINE_TOKEN_PATTERN);

  let lastIndex = 0;
  let match = tokenPattern.exec(text);

  while (match) {
    const rawToken = match[0];

    if (isEscapedInlineMarkdownToken(text, match.index)) {
      const escapeStartIndex = match.index - 1;

      if (escapeStartIndex > lastIndex) {
        appendText(tokens, text.slice(lastIndex, escapeStartIndex));
      }

      lastIndex = match.index + rawToken.length;
      appendText(tokens, text.slice(escapeStartIndex, lastIndex));
      tokenPattern.lastIndex = lastIndex;
      match = tokenPattern.exec(text);
      continue;
    }

    if (match.index > lastIndex) {
      appendText(tokens, text.slice(lastIndex, match.index));
    }

    const markdownLink = rawToken.startsWith("[")
      ? parseMarkdownLinkAt(text, match.index)
      : null;
    const token = markdownLink?.raw ?? rawToken;

    if (
      (token.startsWith("**") && token.endsWith("**")) ||
      (token.startsWith("__") && token.endsWith("__"))
    ) {
      tokens.push({
        type: "strong",
        children: parseInlineMarkdownTokens(token.slice(2, -2)),
      });
    } else if (token.startsWith("~~") && token.endsWith("~~")) {
      tokens.push({
        type: "strikethrough",
        children: parseInlineMarkdownTokens(token.slice(2, -2)),
      });
    } else if (token.startsWith("`") && token.endsWith("`")) {
      tokens.push({ type: "code", text: token.slice(1, -1) });
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const href = markdownLink ? normalizeMarkdownHref(markdownLink.hrefText) : null;

      if (markdownLink && href) {
        tokens.push({
          type: "link",
          href,
          children: parseInlineMarkdownTokens(markdownLink.label),
        });
      } else {
        appendText(tokens, token);
      }
    } else if (token.startsWith("<http://") || token.startsWith("<https://")) {
      const hrefText = token.slice(1, -1);
      const href = normalizeMarkdownHref(hrefText);

      if (href) {
        tokens.push({
          type: "link",
          href,
          children: [{ type: "text", text: hrefText }],
        });
      } else {
        appendText(tokens, token);
      }
    } else if (token.startsWith("http://") || token.startsWith("https://")) {
      const { hrefText, suffix } = splitBareMarkdownUrlToken(token);
      const href = normalizeMarkdownHref(hrefText);

      if (href) {
        tokens.push({
          type: "link",
          href,
          children: [{ type: "text", text: hrefText }],
        });
        appendText(tokens, suffix);
      } else {
        appendText(tokens, token);
      }
    } else if (
      (token.startsWith("*") && token.endsWith("*")) ||
      (token.startsWith("_") && token.endsWith("_"))
    ) {
      tokens.push({
        type: "emphasis",
        children: parseInlineMarkdownTokens(token.slice(1, -1)),
      });
    } else {
      appendText(tokens, token);
    }

    lastIndex = match.index + token.length;
    tokenPattern.lastIndex = lastIndex;
    match = tokenPattern.exec(text);
  }

  if (lastIndex < text.length) {
    appendText(tokens, text.slice(lastIndex));
  }

  return tokens;
}
