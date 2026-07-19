"use client";

import { BrowserLiveViewer } from "../data-cards/browser-live-viewer";
import { Button } from "@/components/ui/button";
import { X, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrowserWorkspacePaneProps {
  sessionId: string;
  onClose: () => void;
  isOpen: boolean;
}

export function BrowserWorkspacePane({
  sessionId,
  onClose,
  isOpen,
}: BrowserWorkspacePaneProps) {
  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "flex flex-col border-l border-border/70 bg-background/70 shadow-sm backdrop-blur-xl",
        // Desktop: rendered as a flex sibling inside the lg:flex-row chat layout.
        // Must be height-bounded by the parent so inner scroll regions work.
        "lg:static lg:h-full lg:w-[450px] lg:overflow-hidden xl:w-[550px]",
        // Mobile: covers the full viewport as a fixed overlay.
        "fixed inset-0 z-50 h-dvh overflow-hidden"
      )}
    >
      {/* Header — shrinks to its natural height and never scrolls */}
      <div className="flex shrink-0 items-center justify-between border-b border-border/70 p-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-sky-500/10 text-sky-500">
            <Globe className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Browser Workspace</h2>
            <p className="text-[11px] text-muted-foreground">Real-time automation stream</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 rounded-[8px] hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/*
        Content area — takes up all remaining height with `flex-1 min-h-0`.
        `overflow-hidden` clips the BrowserLiveViewer card so its own internal
        `overflow-y-auto` scroll regions get a bounded height and function correctly.
      */}
      <div className="min-h-0 flex-1 overflow-hidden p-4">
        <BrowserLiveViewer
          sessionId={sessionId}
          onClose={onClose}
          allowManualControl={true}
        />
      </div>
    </div>
  );
}
