"use client";

import {
  BriefcaseBusiness,
  CheckCircle2,
  Mic,
  Sparkles,
  Sunrise,
  Workflow,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type OperationsCapabilityCardData = {
  feature?: string;
  title?: string;
  summary?: string;
  access?: string;
  requiredInputs?: unknown;
  nextSteps?: unknown;
  guardrails?: unknown;
};

const featureIcons = {
  automation: Workflow,
  assets: Sparkles,
  meetings: Mic,
  investor: BriefcaseBusiness,
  morning_brief: Sunrise,
} as const;

function toStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function OperationsCapabilityCard({
  data,
}: {
  data: OperationsCapabilityCardData;
}) {
  const feature =
    typeof data.feature === "string" ? data.feature : "automation";
  const Icon =
    feature in featureIcons
      ? featureIcons[feature as keyof typeof featureIcons]
      : CheckCircle2;
  const requiredInputs = toStringList(data.requiredInputs);
  const nextSteps = toStringList(data.nextSteps);

  return (
    <Card className="w-full max-w-xl overflow-hidden border-border/70 bg-card/90 shadow-sm">
      <CardHeader className="space-y-3 border-b border-border/70 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Chat capability
              </p>
              <CardTitle className="text-base">
                {typeof data.title === "string" ? data.title : "Operations"}
              </CardTitle>
            </div>
          </div>
          {data.access === "chat_only" ? (
            <Badge variant="outline" className="shrink-0">
              Chat only
            </Badge>
          ) : null}
        </div>
        {typeof data.summary === "string" ? (
          <p className="text-sm leading-6 text-muted-foreground">
            {data.summary}
          </p>
        ) : null}
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-2">
        {requiredInputs.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Inputs
            </p>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/85">
              {requiredInputs.slice(0, 5).map((input) => (
                <li key={input} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                  <span>{input}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {nextSteps.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
              Next
            </p>
            <ol className="mt-2 space-y-1.5 text-sm text-foreground/85">
              {nextSteps.slice(0, 4).map((step, index) => (
                <li key={step} className="flex gap-2">
                  <span className="shrink-0 text-xs font-semibold text-muted-foreground">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
