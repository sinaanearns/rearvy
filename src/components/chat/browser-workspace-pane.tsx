"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { BrowserLiveViewer } from "@/components/data-cards/browser-live-viewer";
import { Globe, PanelLeftClose } from "lucide-react";

interface BrowserWorkspacePaneProps {
  data: Record<string, unknown>;
  onClose: () => void;
  // Optional chat integration when showing the workspace pane.
  messages?: Array<unknown>;
  onSend?: (text: string, files?: File[]) => void;
  isLoading?: boolean;
  chatId?: string | null;
}

function asStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  const uniqueItems = new Set<string>();

  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }

    const normalized = item.trim();
    if (!normalized) {
      continue;
    }

    uniqueItems.add(normalized);
  }

  return Array.from(uniqueItems);
}

function firstNonEmptyString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function BrowserWorkspacePane({
  data,
  onClose,
  messages = [],
  onSend,
  isLoading = false,
  chatId = null,
}: BrowserWorkspacePaneProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const isElectron = isClient && typeof window !== "undefined" && window.navigator.userAgent.toLowerCase().includes("electron");
  const status =
    typeof data.status === "string" && data.status.trim()
      ? data.status
      : "ready";
  const summary =
    typeof data.summary === "string" && data.summary.trim()
      ? data.summary
      : typeof data.message === "string" && data.message.trim()
        ? data.message
        : "Live browser session";
  const task =
    typeof data.task === "string" && data.task.trim() ? data.task : null;
  const blocker =
    typeof data.blocker === "string" && data.blocker.trim()
      ? data.blocker
      : null;
  const currentUrl = firstNonEmptyString(
    data.currentUrl,
    data.current_url,
    data.finalUrl,
    data.final_url,
    data.url
  );
  const notes = asStringArray(data.notes);
  const activityLines = [
    task ? `Task: ${task}` : null,
    summary,
    ...notes.slice(0, 3).map((note) => `Note: ${note}`),
    blocker ? `Blocker: ${blocker}` : null,
  ].filter(Boolean) as string[];
  return (
    <aside className="flex min-h-0 w-full flex-col border-b border-border/70 bg-background/95 lg:w-[min(48vw,58rem)] lg:border-b-0 lg:border-r">
      <div className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="h-4 w-4 text-sky-500" />
              <span>App Browser Activity</span>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {task ?? currentUrl ?? "Live browser session"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              {summary} You can interact with the browser.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {status}
            </span>
            <Button type="button" size="sm" variant="outline" onClick={onClose}>
              <PanelLeftClose className="mr-2 h-4 w-4" />
              Hide
            </Button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden p-0 sm:p-0">
        <div className="flex h-full flex-col lg:flex-row">
          <div className="min-h-0 flex-1 border-r border-border/70 p-3 sm:p-4">
            <BrowserLiveViewer
              data={data}
              blocker={blocker}
              summary={summary}
              task={task}
              toneLabel={status}
              fallbackActivityLines={activityLines}
              variant="workspace"
              allowManualControl={true}
              className="h-full"
            />
          </div>

          <div className="min-h-0 w-full max-w-full lg:w-96 flex flex-col">
            <div className="border-b border-border/70 bg-background/95 px-3 py-2">
              <p className="text-sm font-semibold">Browser Chat</p>
              <p className="text-xs text-muted-foreground">Interact with the assistant while viewing the browser.</p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {Array.isArray(messages) && messages.length > 0 ? (
                messages.slice(-50).map((message: any) => (
                  <div key={message.id ?? Math.random()} className="mb-3">
                    {/* reuse existing MessageBubble style via simple markup */}
                    <div className="rounded-xl border border-border/70 bg-card/60 px-3 py-2 text-sm">
                      <div className="font-medium">{message.role}</div>
                      <div className="whitespace-pre-wrap text-sm text-foreground">{(message.parts || []).map((p: any) => (p.type === 'text' ? p.text : JSON.stringify(p))).join('\n')}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No messages yet.</div>
              )}
            </div>

            <div className="border-t border-border/70 p-3">
              {/* Small inline input - reuse ChatInput component if available via props */}
              {onSend ? (
                <div>
                  {/* lightweight input */}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const form = e.target as HTMLFormElement;
                      const input = form.querySelector('input[name="browser-chat-input"]') as HTMLInputElement | null;
                      if (!input) return;
                      const value = input.value.trim();
                      if (!value) return;
                      onSend(value);
                      input.value = '';
                    }}
                  >
                    <div className="flex gap-2">
                      <input name="browser-chat-input" placeholder="Send a message to the assistant" className="flex-1 rounded-lg border px-3 py-2 text-sm bg-background/80" />
                      <button type="submit" className="inline-flex items-center rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white">Send</button>
                    </div>
                  </form>
                </div>
              ) : (
                <div className="text-xs text-muted-foreground">Chat unavailable.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
