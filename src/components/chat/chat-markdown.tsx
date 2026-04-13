"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Copy, Check as CheckIcon } from "lucide-react";
import { InteractiveExplainerCard } from "./interactive-explainer-card";
import { ClaudeCardsBlock } from "./claude-cards-block";
import { TradeSignalChartBlock } from "./trade-signal-chart-block";

type MarkdownBlock =
  | { type: "heading"; level: number; content: string }
  | { type: "paragraph"; content: string }
  | { type: "unordered-list"; items: string[] }
  | { type: "ordered-list"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "blockquote"; content: string }
  | { type: "claude-cards"; configText: string }
  | { type: "interactive-explainer"; configText: string }
  | { type: "trade-chart"; configText: string }
  | { type: "code"; language: string | null; content: string }
  | { type: "prompt"; content: string }
  | { type: "divider" };

function isBlockStart(line: string): boolean {
  return (
    line.startsWith("```") ||
    /^#{1,6}\s+/.test(line) ||
    /^>\s?/.test(line) ||
    /^[-*]\s+/.test(line) ||
    /^\d+\.\s+/.test(line) ||
    /^---+$/.test(line)
  );
}

function parseMarkdownBlocks(content: string): MarkdownBlock[] {
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
      const language = line.slice(3).trim() || null;
      const codeLines: string[] = [];
      index += 1;

      while (index < lines.length && !lines[index].trim().startsWith("```")) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) {
        index += 1;
      }

      if (language === "claude-cards" || language === "claude-card" || language === "cards") {
        blocks.push({
          type: "claude-cards",
          configText: codeLines.join("\n"),
        });
        continue;
      }

      if (language === "interactive" || language === "interactive-explainer") {
        blocks.push({
          type: "interactive-explainer",
          configText: codeLines.join("\n"),
        });
        continue;
      }

      if (
        language === "trade-chart" ||
        language === "trade-signal-chart" ||
        language === "signal-chart"
      ) {
        blocks.push({
          type: "trade-chart",
          configText: codeLines.join("\n"),
        });
        continue;
      }

      blocks.push({
        type: "code",
        language,
        content: codeLines.join("\n"),
      });
      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isMarkdownTableSeparator(lines[index + 1].trim())
    ) {
      const headers = parseTableRow(line);
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

      blocks.push({ type: "table", headers, rows });
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

    if (/^---+$/.test(line)) {
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

    if (/^[-*]\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const nextLine = lines[index].trim();
        const itemMatch = nextLine.match(/^[-*]\s+(.*)$/);

        if (!itemMatch) {
          break;
        }

        items.push(itemMatch[1]);
        index += 1;
      }

      blocks.push({ type: "unordered-list", items });
      continue;
    }

    if (/^\d+\.\s+/.test(line)) {
      const items: string[] = [];

      while (index < lines.length) {
        const nextLine = lines[index].trim();
        const itemMatch = nextLine.match(/^\d+\.\s+(.*)$/);

        if (!itemMatch) {
          break;
        }

        items.push(itemMatch[1]);
        index += 1;
      }

      blocks.push({ type: "ordered-list", items });
      continue;
    }

    // Handle "Direct prompt" special cases with a more flexible match
    const promptHeaderRegex = /^Direct prompt for your AI chat implementation:?$/i;
    if (promptHeaderRegex.test(line)) {
      blocks.push({
        type: "paragraph",
        content: line,
      });
      index += 1;
      
      // If the next block is a code block, we'll treat it specially as a prompt block
      if (index < lines.length && lines[index].trim().startsWith("```")) {
        const promptLines: string[] = [];
        index += 1; // skip the ```
        while (index < lines.length && !lines[index].trim().startsWith("```")) {
          promptLines.push(lines[index]);
          index += 1;
        }
        if (index < lines.length) index += 1; // skip closing ```
        
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

      if (isBlockStart(nextLine)) {
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

function isMarkdownTableSeparator(line: string): boolean {
  const normalized = line.trim();
  if (!normalized.includes("-")) return false;

  const core = normalized.replace(/^\|/, "").replace(/\|$/, "");
  const segments = core.split("|").map((segment) => segment.trim());

  if (segments.length < 2) return false;

  return segments.every((segment) => /^:?-{3,}:?$/.test(segment));
}

function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function CodeBlock({ content, language }: { content: string; language: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-secondary/30 backdrop-blur-md shadow-sm transition-all hover:bg-secondary/40">
      <div className="flex items-center justify-between border-b border-border/50 px-4 py-2 bg-background/40">
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80">
          {language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="rounded-lg p-1.5 text-muted-foreground/70 hover:bg-card hover:text-foreground transition-all"
          title="Copy to clipboard"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-6 text-foreground/90 font-mono scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/20">
        <code>{content}</code>
      </pre>
    </div>
  );
}

function PromptBlock({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignored
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-2xl border-2 border-slate-700/50 bg-slate-900 shadow-2xl transition-all hover:border-slate-600/70">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-4 py-2 bg-slate-950/40">
        <div className="flex items-center gap-2">
           <div className="h-2 w-2 rounded-full bg-slate-600"></div>
           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
            Internal Prompt
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-all"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-400" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <div className="px-5 py-5 text-[14px] leading-7 text-slate-300 font-mono whitespace-pre-wrap break-words min-h-[80px]">
        {content}
      </div>
    </div>
  );
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenPattern =
    /(`[^`]+`|\*\*[^*]+\*\*|\[[^\]]+\]\(([^)]+)\)|\*[^*]+\*)/g;

  let lastIndex = 0;
  let tokenIndex = 0;
  let match = tokenPattern.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      nodes.push(
        <Fragment key={`text-${tokenIndex}`}>
          {text.slice(lastIndex, match.index)}
        </Fragment>
      );
      tokenIndex += 1;
    }

    const token = match[0];

    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={`strong-${tokenIndex}`} className="font-semibold text-foreground">
          {renderInlineMarkdown(token.slice(2, -2))}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={`code-${tokenIndex}`}
          className="rounded-md bg-foreground/6 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[") && token.includes("](") && token.endsWith(")")) {
      const linkMatch = token.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (linkMatch) {
        nodes.push(
          <a
            key={`link-${tokenIndex}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        nodes.push(<Fragment key={`fallback-${tokenIndex}`}>{token}</Fragment>);
      }
    } else if (token.startsWith("*") && token.endsWith("*")) {
      nodes.push(
        <em key={`em-${tokenIndex}`} className="italic text-foreground/90">
          {renderInlineMarkdown(token.slice(1, -1))}
        </em>
      );
    } else {
      nodes.push(<Fragment key={`fallback-${tokenIndex}`}>{token}</Fragment>);
    }

    tokenIndex += 1;
    lastIndex = match.index + token.length;
    match = tokenPattern.exec(text);
  }

  if (lastIndex < text.length) {
    nodes.push(<Fragment key={`text-${tokenIndex}`}>{text.slice(lastIndex)}</Fragment>);
  }

  return nodes;
}

const headingClasses: Record<number, string> = {
  1: "text-3xl font-semibold tracking-tight text-foreground",
  2: "text-2xl font-semibold tracking-tight text-foreground",
  3: "text-xl font-semibold tracking-tight text-foreground",
  4: "text-lg font-semibold tracking-tight text-foreground",
  5: "text-base font-semibold tracking-tight text-foreground",
  6: "text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground",
};

interface ChatMarkdownProps {
  content: string;
}

function renderHeading(level: number, content: string, key: number) {
  const className = headingClasses[level] || headingClasses[4];
  const inlineContent = renderInlineMarkdown(content);

  if (level === 1) {
    return (
      <h1 key={key} className={className}>
        {inlineContent}
      </h1>
    );
  }

  if (level === 2) {
    return (
      <h2 key={key} className={className}>
        {inlineContent}
      </h2>
    );
  }

  if (level === 3) {
    return (
      <h3 key={key} className={className}>
        {inlineContent}
      </h3>
    );
  }

  if (level === 4) {
    return (
      <h4 key={key} className={className}>
        {inlineContent}
      </h4>
    );
  }

  if (level === 5) {
    return (
      <h5 key={key} className={className}>
        {inlineContent}
      </h5>
    );
  }

  return (
    <h6 key={key} className={className}>
      {inlineContent}
    </h6>
  );
}

/**
 * Pre-process content before markdown parsing to handle edge cases
 * where the sanitizer may not have fully cleaned the text.
 */
function preProcessContent(raw: string): string {
  let content = raw;

  // Strip any remaining literal \n or \t sequences that should be real whitespace
  content = content.replace(/\\n/g, "\n").replace(/\\t/g, "\t");

  // Remove wrapping JSON part array syntax if present
  // e.g. [{"type": "text", "text": "actual content"}]
  const jsonWrapMatch = content
    .trim()
    .match(
      /^\[\s*\{\s*"type"\s*:\s*"text"\s*,\s*"text"\s*:\s*"([\s\S]+?)"\s*\}\s*\]$/
    );
  if (jsonWrapMatch) {
    try {
      content = JSON.parse(`"${jsonWrapMatch[1]}"`);
    } catch {
      // Not valid, keep original
    }
  }

  // Collapse 3+ consecutive newlines to 2
  content = content.replace(/\n{3,}/g, "\n\n");

  return content.trim();
}

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  const blocks = parseMarkdownBlocks(preProcessContent(content));

  return (
    <div className="space-y-4 break-words text-[15px] leading-7 text-foreground/92">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return renderHeading(block.level, block.content, index);
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} className="text-[15px] leading-7 text-foreground/90">
              {renderInlineMarkdown(block.content)}
            </p>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul
              key={index}
              className="space-y-2 pl-6 text-[15px] leading-7 text-foreground/90 marker:text-muted-foreground"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol
              key={index}
              className="space-y-2 pl-6 text-[15px] leading-7 text-foreground/90 marker:font-semibold marker:text-muted-foreground"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>{renderInlineMarkdown(item)}</li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div key={index} className="overflow-x-auto rounded-2xl border border-border/60 bg-card/50 shadow-sm">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={headerIndex}
                        className="border-b border-border/60 px-4 py-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                      >
                        {renderInlineMarkdown(header)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-border/40 last:border-b-0">
                      {block.headers.map((_, cellIndex) => (
                        <td key={cellIndex} className="px-4 py-3 align-top text-[14px] leading-6 text-foreground/90">
                          {renderInlineMarkdown(row[cellIndex] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        if (block.type === "blockquote") {
          return (
            <blockquote
              key={index}
              className="border-l-2 border-border pl-4 text-[15px] italic leading-7 text-muted-foreground"
            >
              {renderInlineMarkdown(block.content)}
            </blockquote>
          );
        }

        if (block.type === "code") {
          return (
            <CodeBlock 
              key={index} 
              content={block.content} 
              language={block.language} 
            />
          );
        }

        if (block.type === "interactive-explainer") {
          return <InteractiveExplainerCard key={index} configText={block.configText} />;
        }

        if (block.type === "trade-chart") {
          return <TradeSignalChartBlock key={index} configText={block.configText} />;
        }

        if (block.type === "claude-cards") {
          return <ClaudeCardsBlock key={index} configText={block.configText} />;
        }

        if (block.type === "prompt") {
          return (
            <PromptBlock 
              key={index} 
              content={block.content} 
            />
          );
        }

        return <hr key={index} className="border-border/70" />;
      })}
    </div>
  );
}
