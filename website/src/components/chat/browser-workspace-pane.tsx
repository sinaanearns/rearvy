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
        "relative flex flex-col border-l border-border/70 bg-background shadow-xl backdrop-blur-xl",
        // Desktop: rendered as a flex sibling inside the lg:flex-row chat layout.
        "lg:static lg:h-full lg:w-[600px] lg:overflow-hidden xl:w-[750px]",
        // Mobile: covers the full viewport as a fixed overlay.
        "fixed inset-0 z-50 h-dvh overflow-hidden"
      )}
    >
      {/* Floating Close Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="absolute top-3 right-3 z-30 h-8 w-8 rounded-full bg-background/80 backdrop-blur-md shadow-md border border-border/50 hover:bg-background hover:scale-105 transition-all text-foreground"
        title="Close Browser Workspace"
      >
        <X className="h-4 w-4" />
      </Button>

      {/* Full-screen content area */}
      <div className="h-full w-full overflow-hidden">
        <BrowserLiveViewer
          sessionId={sessionId}
          onClose={onClose}
          allowManualControl={true}
        />
      </div>
    </div>
  );
}
