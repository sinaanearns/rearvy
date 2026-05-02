"use client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { BrowserLiveViewer } from "@/components/data-cards/browser-live-viewer";
import { BrowserFocusChat } from "./browser-focus-chat";
import { Globe, PanelLeftClose } from "lucide-react";

interface BrowserSession {
  sessionId: string;
  browserSessionId?: string;
  task?: string;
  status?: string;
  summary?: string;
}

interface BrowserWorkspacePaneProps {
  data: Record<string, unknown>;
  onClose: () => void;
  // Optional chat integration when showing the workspace pane.
  messages?: Array<unknown>;
  onSend?: (text: string, files?: File[]) => void;
  isLoading?: boolean;
  chatId?: string | null;
  // Support for multiple browser sessions
  sessions?: BrowserSession[];
  onBrowserCommand?: (command: string, sessionId: string) => void;
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

function firstNonEmptyString(...values: (unknown | null | undefined)[]) {
  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalized = value.trim();
    if (normalized) {
      return normalized;
    }
  }

  return undefined;
}

export function BrowserWorkspacePane({
  data,
  onClose,
  messages = [],
  onSend,
  isLoading = false,
  chatId = null,
  sessions = [],
  onBrowserCommand,
}: BrowserWorkspacePaneProps) {
  const [userSelectedSessionId, setUserSelectedSessionId] = useState<string | null>(null);

  // Get session list with fallback to current data
  const effectiveSessions: BrowserSession[] =
    sessions && sessions.length > 0
      ? sessions
      : data.browserSessionId || data.sessionId
        ? [
            {
              sessionId: (data.browserSessionId || data.sessionId) as string,
              task: (data.task as string) || undefined,
              status: (data.status as string) || "running",
              summary: (data.summary as string) || undefined,
            },
          ]
        : [];

  // Derive selection: use user choice or fallback to first session
  const selectedSessionId = userSelectedSessionId ?? (effectiveSessions.length > 0 ? effectiveSessions[0].sessionId : null);

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
    <aside className="flex min-h-0 w-full flex-col border-b border-border/70 bg-background/95 lg:w-[min(60vw,72rem)] lg:border-b-0 lg:border-r">
      <div className="border-b border-border/70 bg-background/95 px-4 py-3 backdrop-blur-xl sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="h-4 w-4 text-sky-500" />
              <span>Browser Control Panel</span>
              {effectiveSessions.length > 1 && (
                <span className="ml-2 rounded-full bg-sky-500/20 px-1.5 py-0.5 text-[11px] font-medium">
                  {effectiveSessions.length} active
                </span>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {task ?? currentUrl ?? "Live browser session"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/80">
              Focus and control your browser directly from the chat
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
          {/* Browser Viewer (Left / Top) */}
          <div className="min-h-0 flex-1 border-b border-border/70 p-3 sm:p-4 lg:border-b-0 lg:border-r">
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

          {/* Focus Chat (Right / Bottom) */}
          <div className="min-h-0 w-full max-w-full lg:w-96 flex flex-col">
            <BrowserFocusChat
              key={selectedSessionId || "none"}
              sessions={effectiveSessions}
              currentSessionId={selectedSessionId || undefined}
              onSessionChange={setUserSelectedSessionId}
              onSendCommand={onBrowserCommand}
              isLoading={isLoading}
              className="rounded-none border-0"
            />
          </div>
        </div>
      </div>
    </aside>
  );
}
