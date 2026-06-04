"use client";

import Link from "next/link";
import { MessageSquareWarning } from "lucide-react";

import { Button } from "@/components/ui/button";

export function SidebarFeedback({ pathname }: { pathname: string }) {
  return (
    <div className="px-2 py-3">
      <div className="rounded-[8px] border border-sidebar-border/70 bg-sidebar-accent/20 p-3 shadow-sm shadow-slate-950/[0.03]">
        <div className="space-y-1">
          <p className="text-sm font-medium text-sidebar-foreground">Feedback</p>
          <p className="text-xs leading-5 text-sidebar-foreground/60">
            Tell us about bugs or features on a dedicated page.
          </p>
        </div>

        <Button asChild type="button" className="mt-3 w-full justify-start rounded-[8px]">
          <Link href={`/feedback?from=${encodeURIComponent(pathname)}`}>
            <MessageSquareWarning className="h-4 w-4" />
            Open feedback page
          </Link>
        </Button>
      </div>
    </div>
  );
}
