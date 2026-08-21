"use client";

import { Fragment, useState, type ReactNode } from "react";
import { Copy, Check as CheckIcon } from "lucide-react";
import { InteractiveExplainerCard } from "./interactive-explainer-card";
import { ClaudeCardsBlock } from "./claude-cards-block";
import { TradeSignalChartBlock } from "./trade-signal-chart-block";
import {
  parseMarkdownBlocks,
  preProcessMarkdownContent,
  type MarkdownTableAlignment,
} from "./chat-markdown-blocks";
import {
  parseInlineMarkdownTokens,
  type InlineMarkdownToken,
} from "./chat-inline-markdown";
import { parseMarkdownTaskListItem } from "./chat-list-items";

function CodeBlock({ content, language }: { content: string; language: string | null }) {
  const [copied, setCopied] = useState(false);
  const languageLabel = language ? language.replace(/[-_]/g, " ") : "Code";

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
    <div className="group relative w-full max-w-full overflow-hidden rounded-[8px] border border-border/70 bg-secondary/30 shadow-sm backdrop-blur-md transition-all hover:bg-secondary/40">
      <div className="flex items-center justify-between border-b border-border/50 bg-background/45 px-4 py-2.5">
        <span className="text-xs font-semibold capitalize text-muted-foreground/85">
          {languageLabel}
        </span>
        <button
          onClick={handleCopy}
          className="rounded-[8px] p-1.5 text-muted-foreground/70 transition-all hover:bg-card hover:text-foreground"
          title="Copy to clipboard"
        >
          {copied ? (
            <CheckIcon className="h-3.5 w-3.5 text-emerald-500" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>
      <pre className="max-w-full overflow-x-auto px-4 py-4 font-mono text-[13px] leading-6 text-foreground/90 whitespace-pre-wrap sm:whitespace-pre scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-muted-foreground/20">
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
    <div className="group relative overflow-hidden rounded-[8px] border border-slate-700/50 bg-slate-900 shadow-sm transition-all hover:border-slate-600/70">
      <div className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
           <div className="h-2 w-2 rounded-full bg-slate-600"></div>
           <span className="text-xs font-semibold text-slate-400">
            Internal Prompt
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="rounded-[8px] p-1.5 text-slate-500 transition-all hover:bg-slate-800 hover:text-white"
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

function renderInlineTokens(tokens: InlineMarkdownToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((token, tokenIndex) => {
    const key = `${keyPrefix}-${token.type}-${tokenIndex}`;

    if (token.type === "text") {
      return <Fragment key={key}>{token.text}</Fragment>;
    }

    if (token.type === "strong") {
      return (
        <strong key={key} className="font-semibold text-foreground">
          {renderInlineTokens(token.children, key)}
        </strong>
      );
    }

    if (token.type === "code") {
      return (
        <code
          key={key}
          className="rounded-[8px] bg-foreground/6 px-1.5 py-0.5 font-mono text-[0.9em] text-foreground"
        >
          {token.text}
        </code>
      );
    }

    if (token.type === "link") {
      return (
        <a
          key={key}
          href={token.href}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary"
        >
          {renderInlineTokens(token.children, key)}
        </a>
      );
    }

    if (token.type === "strikethrough") {
      return (
        <del key={key} className="text-foreground/70 decoration-border">
          {renderInlineTokens(token.children, key)}
        </del>
      );
    }

    return (
      <em key={key} className="italic text-foreground/90">
        {renderInlineTokens(token.children, key)}
      </em>
    );
  });
}

function renderInlineMarkdown(text: string): ReactNode[] {
  return renderInlineTokens(parseInlineMarkdownTokens(text), "inline");
}

function renderUnorderedListItem(item: string, itemIndex: number) {
  const taskItem = parseMarkdownTaskListItem(item);

  if (!taskItem) {
    return (
      <li key={itemIndex} className="break-words">
        {renderInlineMarkdown(item)}
      </li>
    );
  }

  return (
    <li key={itemIndex} className="flex list-none items-start gap-2 break-words">
      <input
        type="checkbox"
        checked={taskItem.checked}
        readOnly
        tabIndex={-1}
        aria-label={taskItem.checked ? "Completed task" : "Incomplete task"}
        className="mt-[0.4rem] h-4 w-4 shrink-0 rounded-[4px] border-border accent-primary"
      />
      <span className="min-w-0 flex-1">{renderInlineMarkdown(taskItem.content)}</span>
    </li>
  );
}

const headingClasses: Record<number, string> = {
  1: "text-[1.55rem] font-semibold leading-[1.35] tracking-normal text-foreground",
  2: "text-[1.35rem] font-semibold leading-[1.4] tracking-normal text-foreground",
  3: "text-[1.18rem] font-semibold leading-[1.45] tracking-normal text-foreground",
  4: "text-[1.05rem] font-semibold leading-[1.5] tracking-normal text-foreground",
  5: "text-base font-semibold leading-7 tracking-normal text-foreground",
  6: "text-sm font-semibold leading-6 tracking-normal text-muted-foreground",
};

const tableAlignmentClasses: Record<MarkdownTableAlignment, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
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

export function ChatMarkdown({ content }: ChatMarkdownProps) {
  const blocks = parseMarkdownBlocks(preProcessMarkdownContent(content));

  return (
    <div className="min-w-0 max-w-full space-y-5 break-words text-[16px] leading-7 text-foreground">
      {blocks.map((block, index) => {
        if (block.type === "heading") {
          return renderHeading(block.level, block.content, index);
        }

        if (block.type === "paragraph") {
          return (
            <p key={index} className="break-words text-[16px] leading-7 text-foreground">
              {renderInlineMarkdown(block.content)}
            </p>
          );
        }

        if (block.type === "unordered-list") {
          return (
            <ul
              key={index}
              className="space-y-2 pl-7 text-[16px] leading-7 text-foreground marker:text-muted-foreground"
            >
              {block.items.map((item, itemIndex) =>
                renderUnorderedListItem(item, itemIndex)
              )}
            </ul>
          );
        }

        if (block.type === "ordered-list") {
          return (
            <ol
              key={index}
              start={block.start}
              className="space-y-2 pl-7 text-[16px] leading-7 text-foreground marker:font-semibold marker:text-muted-foreground"
            >
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="break-words">
                  {renderInlineMarkdown(item)}
                </li>
              ))}
            </ol>
          );
        }

        if (block.type === "table") {
          return (
            <div key={index} className="w-full max-w-full overflow-x-auto rounded-[8px] border border-border/60 bg-card/50 shadow-sm">
              <table className="min-w-full border-collapse text-left text-sm">
                <thead className="bg-muted/60">
                  <tr>
                    {block.headers.map((header, headerIndex) => (
                      <th
                        key={headerIndex}
                        className={`border-b border-border/60 px-4 py-3 text-[13px] font-semibold text-muted-foreground ${
                          tableAlignmentClasses[block.alignments[headerIndex] ?? "left"]
                        }`}
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
                        <td
                          key={cellIndex}
                          className={`px-4 py-3 align-top text-[14px] leading-6 text-foreground/90 ${
                            tableAlignmentClasses[block.alignments[cellIndex] ?? "left"]
                          }`}
                        >
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
