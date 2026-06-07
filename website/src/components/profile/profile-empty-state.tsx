import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type ProfileEmptyStateTone = "cyan" | "amber" | "emerald" | "slate";

const profileEmptyStateTones: Record<
  ProfileEmptyStateTone,
  { shell: string; icon: string; accent: string; action: string }
> = {
  cyan: {
    shell: "border-cyan-200/55 bg-cyan-50/55 dark:border-cyan-900/50 dark:bg-cyan-950/20",
    icon: "border-cyan-200 bg-cyan-100 text-cyan-700 dark:border-cyan-900/60 dark:bg-cyan-950/70 dark:text-cyan-200",
    accent: "bg-cyan-500/70",
    action: "border-cyan-200/70 bg-cyan-100/70 text-cyan-950 hover:bg-cyan-100 dark:border-cyan-800/70 dark:bg-cyan-950/70 dark:text-cyan-100",
  },
  amber: {
    shell: "border-amber-200/60 bg-amber-50/60 dark:border-amber-900/50 dark:bg-amber-950/20",
    icon: "border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/70 dark:text-amber-200",
    accent: "bg-amber-500/70",
    action: "border-amber-200/70 bg-amber-100/70 text-amber-950 hover:bg-amber-100 dark:border-amber-800/70 dark:bg-amber-950/70 dark:text-amber-100",
  },
  emerald: {
    shell: "border-emerald-200/60 bg-emerald-50/60 dark:border-emerald-900/50 dark:bg-emerald-950/20",
    icon: "border-emerald-200 bg-emerald-100 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/70 dark:text-emerald-200",
    accent: "bg-emerald-500/70",
    action: "border-emerald-200/70 bg-emerald-100/70 text-emerald-950 hover:bg-emerald-100 dark:border-emerald-800/70 dark:bg-emerald-950/70 dark:text-emerald-100",
  },
  slate: {
    shell: "border-border/70 bg-muted/25 dark:border-white/12 dark:bg-white/[0.035]",
    icon: "border-border/70 bg-background text-muted-foreground dark:border-white/12 dark:bg-white/[0.06]",
    accent: "bg-muted-foreground/45",
    action: "border-border/70 bg-background text-foreground hover:bg-muted dark:border-white/12 dark:bg-white/[0.06] dark:hover:bg-white/[0.1]",
  },
};

export function ProfileEmptyState({
  icon: Icon,
  title,
  detail,
  action,
  tone = "cyan",
  className,
}: {
  icon: LucideIcon;
  title: string;
  detail: string;
  action?: {
    href: string;
    label: string;
  };
  tone?: ProfileEmptyStateTone;
  className?: string;
}) {
  const toneStyles = profileEmptyStateTones[tone];

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border p-4 shadow-sm shadow-slate-950/[0.03]",
        toneStyles.shell,
        className
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
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
          {action ? (
            <Link
              href={action.href}
              className={cn(
                "mt-3 inline-flex min-h-9 items-center justify-center gap-2 rounded-[8px] border px-3 text-xs font-semibold transition",
                toneStyles.action
              )}
            >
              {action.label}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
