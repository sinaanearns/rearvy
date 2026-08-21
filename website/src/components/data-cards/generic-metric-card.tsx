"use client";

import { Gauge } from "lucide-react";

import { DataCardFrame } from "./data-card-frame";

interface GenericMetricCardProps {
  data: Record<string, unknown>;
  toolName: string;
}

function formatLabel(value: string) {
  return value.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim();
}

export function GenericMetricCard({ data, toolName }: GenericMetricCardProps) {
  if (!data || typeof data !== "object") return null;

  const title = toolName.replace(/^get/, "").replace(/([A-Z])/g, " $1").trim();
  const entries = Object.entries(data).filter(([, value]) => {
    return !Array.isArray(value) && (value === null || typeof value !== "object");
  });

  return (
    <DataCardFrame
      icon={Gauge}
      title={title || "Metric result"}
      subtitle="Structured tool output"
      tone="violet"
    >
      <dl className="space-y-2 text-sm">
        {entries.map(([key, value]) => {
          if (key === "message" && typeof value === "string") {
            return (
              <div
                key={key}
                className="rounded-[8px] border border-border/70 bg-muted/30 p-3 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]"
              >
                {value}
              </div>
            );
          }

          return (
            <div
              key={key}
              className="flex items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-background/78 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]"
            >
              <dt className="min-w-0 truncate text-muted-foreground">{formatLabel(key)}</dt>
              <dd className="shrink-0 text-right font-semibold text-foreground">
                {String(value)}
              </dd>
            </div>
          );
        })}
      </dl>
    </DataCardFrame>
  );
}
