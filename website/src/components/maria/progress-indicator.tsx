"use client";

import { Clock, FileText, Brain, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type MariaProgressEvent = {
  type: string;
  total?: number;
  completed?: number;
  currentTask?: string;
  percentage?: number;
  durationMs?: number;
  operation?: string;
  filePath?: string;
  lineRange?: [number, number];
};

type MariaProgressIndicatorProps = {
  events: MariaProgressEvent[];
  isThinking: boolean;
  isBusy: boolean;
  className?: string;
};

export function MariaProgressIndicator({
  events,
  isThinking,
  isBusy,
  className,
}: MariaProgressIndicatorProps) {
  const latestEvent = events[events.length - 1];
  const taskProgress = events.find(e => e.type === "task-progress");
  const thinkingEvent = events.find(e => e.type === "thinking-completed");
  const fileEvent = events.find(e => e.type === "file-operation");

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  };

  const formatLineRange = (range?: [number, number]) => {
    if (!range) return "";
    return ` #L${range[0]}-${range[1]}`;
  };

  if (!isBusy && !isThinking) {
    return null;
  }

  // Show a simple message if no events but busy
  if (events.length === 0) {
    return (
      <div
        className={cn(
          "w-full rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.032))]",
          className
        )}
      >
        <div className="flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
          <span className="font-medium text-muted-foreground">
            {isThinking ? "Thinking..." : "Working..."}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "w-full rounded-lg border border-border/70 bg-card/85 p-4 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.032))]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 space-y-3">
          {/* Thinking Section */}
          {isThinking && (
            <div className="flex items-center gap-2 text-sm">
              <Brain className="h-4 w-4 text-blue-500 animate-pulse" />
              <span className="font-medium text-muted-foreground">Thinking</span>
              {thinkingEvent?.durationMs && (
                <span className="text-xs text-muted-foreground">
                  for {formatDuration(thinkingEvent.durationMs)}
                </span>
              )}
            </div>
          )}

          {/* Task Progress */}
          {taskProgress && taskProgress.total && taskProgress.total > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
              <span className="font-medium text-muted-foreground">
                {taskProgress.completed} / {taskProgress.total} tasks done
              </span>
              {taskProgress.percentage && (
                <span className="text-xs text-muted-foreground">
                  ({taskProgress.percentage}%)
                </span>
              )}
            </div>
          )}

          {/* Current Task Description */}
          {taskProgress?.currentTask && (
            <div className="text-sm text-foreground/80 pl-6">
              {taskProgress.currentTask}
            </div>
          )}

          {/* File Operations */}
          {fileEvent && fileEvent.filePath && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                {fileEvent.operation || "Reading"} {fileEvent.filePath}
                {formatLineRange(fileEvent.lineRange)}
              </span>
            </div>
          )}
        </div>

        {/* Approval Button */}
        {isBusy && (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
            onClick={() => {
              // Handle approval - this would emit an approval event
              console.log("User approved the action");
            }}
          >
            yes
          </button>
        )}
      </div>
    </div>
  );
}
