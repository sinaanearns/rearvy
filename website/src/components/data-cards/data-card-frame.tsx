import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DataCardTone = "cyan" | "emerald" | "amber" | "rose" | "violet";

const toneStyles: Record<
  DataCardTone,
  {
    accent: string;
    icon: string;
    soft: string;
    text: string;
  }
> = {
  cyan: {
    accent: "from-cyan-300 via-emerald-300 to-blue-300",
    icon: "border-cyan-200/30 bg-cyan-200/10 text-cyan-600 dark:text-cyan-200",
    soft: "bg-cyan-500/10",
    text: "text-cyan-600 dark:text-cyan-200",
  },
  emerald: {
    accent: "from-emerald-300 via-cyan-300 to-lime-300",
    icon: "border-emerald-200/30 bg-emerald-200/10 text-emerald-600 dark:text-emerald-200",
    soft: "bg-emerald-500/10",
    text: "text-emerald-600 dark:text-emerald-200",
  },
  amber: {
    accent: "from-amber-300 via-orange-300 to-rose-300",
    icon: "border-amber-200/30 bg-amber-200/10 text-amber-600 dark:text-amber-200",
    soft: "bg-amber-500/10",
    text: "text-amber-600 dark:text-amber-200",
  },
  rose: {
    accent: "from-rose-300 via-fuchsia-300 to-violet-300",
    icon: "border-rose-200/30 bg-rose-200/10 text-rose-600 dark:text-rose-200",
    soft: "bg-rose-500/10",
    text: "text-rose-600 dark:text-rose-200",
  },
  violet: {
    accent: "from-violet-300 via-cyan-300 to-indigo-300",
    icon: "border-violet-200/30 bg-violet-200/10 text-violet-600 dark:text-violet-200",
    soft: "bg-violet-500/10",
    text: "text-violet-600 dark:text-violet-200",
  },
};

export function DataCardFrame({
  icon: Icon,
  title,
  subtitle,
  accessory,
  tone = "cyan",
  children,
  className,
}: {
  icon: LucideIcon;
  title: string;
  subtitle?: string;
  accessory?: ReactNode;
  tone?: DataCardTone;
  children: ReactNode;
  className?: string;
}) {
  const styles = toneStyles[tone];

  return (
    <Card
      className={cn(
        "relative w-full max-w-xl overflow-hidden rounded-[8px] border-border/70 bg-card/90 py-0 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-white/[0.04]",
        className
      )}
    >
      <div className={cn("h-1 bg-gradient-to-r", styles.accent)} />
      <CardContent className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border", styles.icon)}>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">{title}</span>
              {subtitle ? (
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {subtitle}
                </span>
              ) : null}
            </span>
          </div>
          {accessory ? <div className="shrink-0">{accessory}</div> : null}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

export function DataMetricTile({
  label,
  value,
  tone = "cyan",
}: {
  label: string;
  value: ReactNode;
  tone?: DataCardTone;
}) {
  return (
    <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
      <p className={cn("text-lg font-semibold leading-none", toneStyles[tone].text)}>
        {value}
      </p>
      <p className="mt-1 text-xs font-medium text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

export function DataCardMessage({
  icon,
  message,
  tone = "cyan",
  title = "Data note",
}: {
  icon: LucideIcon;
  message: string;
  tone?: DataCardTone;
  title?: string;
}) {
  return (
    <DataCardFrame icon={icon} title={title} tone={tone}>
      <div className={cn("rounded-[8px] border border-border/70 p-3 text-sm leading-6 text-muted-foreground dark:border-white/10", toneStyles[tone].soft)}>
        {message}
      </div>
    </DataCardFrame>
  );
}
