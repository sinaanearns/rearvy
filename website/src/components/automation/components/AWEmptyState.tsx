"use client";

import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type AWEmptyStateTone = "cyan" | "emerald" | "blue" | "slate";

const emptyStateTones: Record<
  AWEmptyStateTone,
  { shell: string; icon: string; accent: string }
> = {
  cyan: {
    shell: "border-cyan-200/70 bg-cyan-50/70 dark:border-cyan-900/50 dark:bg-cyan-950/20",
    icon: "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/70 dark:text-cyan-200",
    accent: "bg-cyan-500/70",
  },
  emerald: {
    shell: "border-emerald-200/70 bg-emerald-50/70 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    icon: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-200",
    accent: "bg-emerald-500/70",
  },
  blue: {
    shell: "border-blue-200/70 bg-blue-50/70 dark:border-blue-900/50 dark:bg-blue-950/20",
    icon: "border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-900/60 dark:bg-blue-950/70 dark:text-blue-200",
    accent: "bg-blue-500/70",
  },
  slate: {
    shell: "border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/40",
    icon: "border-slate-200 bg-white text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300",
    accent: "bg-slate-400/70",
  },
};

export function AWEmptyState({
  icon: Icon,
  title,
  detail,
  tone = "cyan",
  compact = false,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  tone?: AWEmptyStateTone;
  compact?: boolean;
}) {
  const toneStyles = emptyStateTones[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border shadow-sm shadow-slate-950/[0.03]",
        compact ? "p-3" : "p-5",
        toneStyles.shell
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", toneStyles.accent)} />
      <div className="flex min-w-0 items-start gap-3 pl-1">
        <span
          aria-hidden
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border",
            toneStyles.icon
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-950 dark:text-slate-100">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-400">{detail}</p>
        </div>
      </div>
    </div>
  );
}
