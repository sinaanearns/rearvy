import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardHeroAccent = "cyan" | "amber" | "emerald" | "indigo";

const accentStyles: Record<
  DashboardHeroAccent,
  {
    wash: string;
    badgeIcon: string;
    icon: string;
  }
> = {
  cyan: {
    wash:
      "bg-[linear-gradient(112deg,rgba(105,215,255,0.13),transparent_34%),linear-gradient(248deg,rgba(125,231,199,0.1),transparent_38%)]",
    badgeIcon: "text-cyan-500",
    icon: "border-cyan-200/35 bg-cyan-200/10 text-cyan-600 dark:text-cyan-100",
  },
  amber: {
    wash:
      "bg-[linear-gradient(112deg,rgba(105,215,255,0.12),transparent_34%),linear-gradient(248deg,rgba(247,201,72,0.12),transparent_38%)]",
    badgeIcon: "text-amber-500",
    icon: "border-amber-200/40 bg-amber-200/10 text-amber-600 dark:text-amber-100",
  },
  emerald: {
    wash:
      "bg-[linear-gradient(112deg,rgba(45,212,191,0.12),transparent_34%),linear-gradient(248deg,rgba(52,211,153,0.12),transparent_38%)]",
    badgeIcon: "text-emerald-500",
    icon: "border-emerald-200/35 bg-emerald-200/10 text-emerald-600 dark:text-emerald-100",
  },
  indigo: {
    wash:
      "bg-[linear-gradient(112deg,rgba(105,215,255,0.11),transparent_34%),linear-gradient(248deg,rgba(129,140,248,0.13),transparent_38%)]",
    badgeIcon: "text-indigo-500",
    icon: "border-indigo-200/35 bg-indigo-200/10 text-indigo-600 dark:text-indigo-100",
  },
};

export type DashboardHeroMetric = {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon: LucideIcon;
};

type DashboardPageHeroProps = {
  eyebrow: string;
  title: ReactNode;
  description: ReactNode;
  icon: LucideIcon;
  metrics: DashboardHeroMetric[];
  actions?: ReactNode;
  accent?: DashboardHeroAccent;
  className?: string;
};

export function DashboardPageHero({
  eyebrow,
  title,
  description,
  icon: Icon,
  metrics,
  actions,
  accent = "cyan",
  className,
}: DashboardPageHeroProps) {
  const tone = accentStyles[accent];

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-border/70 bg-card/[0.88] p-5 shadow-sm shadow-slate-950/[0.03] dark:bg-slate-950/[0.82] sm:p-6",
        className
      )}
    >
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", tone.wash)} />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,0.78fr)_minmax(360px,0.72fr)] lg:items-end">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-[8px] border border-border/70 bg-background/[0.72] px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.05]">
            <Icon className={cn("h-3.5 w-3.5", tone.badgeIcon)} aria-hidden="true" />
            {eyebrow}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {title}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
            {description}
          </p>
          {actions ? <div className="mt-5 flex flex-wrap gap-2">{actions}</div> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {metrics.map((metric) => {
            const MetricIcon = metric.icon;

            return (
              <div
                key={metric.label}
                className="group grid min-h-[82px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-border/70 bg-background/[0.78] p-3 shadow-sm shadow-slate-950/[0.03] transition-colors hover:border-cyan-200/45 dark:border-white/10 dark:bg-white/[0.05]"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[8px] border transition-transform group-hover:-translate-y-0.5",
                    tone.icon
                  )}
                >
                  <MetricIcon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{metric.value}</p>
                  <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                    {metric.label}
                  </p>
                  {metric.detail ? (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground/80">
                      {metric.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
