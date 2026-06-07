"use client";

import Link from "next/link";
import { ArrowUpRight, MessageSquareWarning, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SidebarFeedback({ pathname }: { pathname: string }) {
  const sourcePath = pathname.split("?")[0] || "/";

  return (
    <div className="px-2 py-3">
      <div className="group relative overflow-hidden rounded-[8px] border border-sidebar-border/70 bg-sidebar-accent/[0.18] p-3 shadow-sm shadow-slate-950/[0.03] transition-colors hover:border-sidebar-border">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/45 to-transparent opacity-70"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(105,215,255,0.1),transparent_46%)] opacity-0 transition-opacity group-hover:opacity-100"
        />

        <div className="relative space-y-3">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-sidebar-border/70 bg-sidebar-accent text-sidebar-foreground shadow-sm">
              <MessageSquareWarning className="h-4 w-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-2">
                <p className="truncate text-sm font-semibold text-sidebar-foreground">Feedback</p>
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-cyan-500 dark:text-cyan-200" aria-hidden="true" />
              </div>
              <p className="mt-1 text-xs leading-5 text-sidebar-foreground/62">
                Send bugs or feature notes with the current page attached.
              </p>
            </div>
          </div>

          <div className="rounded-[8px] border border-sidebar-border/60 bg-sidebar-accent/[0.18] px-2.5 py-1.5">
            <p className="truncate text-[11px] font-medium text-sidebar-foreground/58">
              From {sourcePath}
            </p>
          </div>

          <Button asChild type="button" className="h-9 w-full justify-between rounded-[8px] px-3">
            <Link href={`/feedback?from=${encodeURIComponent(pathname)}`}>
              <span className="flex min-w-0 items-center gap-2">
                <MessageSquareWarning className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="truncate">Open feedback</span>
              </span>
              <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
