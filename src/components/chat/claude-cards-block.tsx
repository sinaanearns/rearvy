"use client";

import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, Minus, Sparkles } from "lucide-react";

type ClaudeCardItem = {
  label: string;
  value?: string | number;
  benchmark?: string;
  note?: string;
  delta?: string;
  tone?: "good" | "neutral" | "bad" | "accent";
  sparkline?: number[];
};

type ClaudeCardsConfig = {
  title?: string;
  subtitle?: string;
  cards?: ClaudeCardItem[];
};

function safeParseConfig(configText: string): ClaudeCardsConfig {
  try {
    const parsed = JSON.parse(configText) as ClaudeCardsConfig;
    if (!parsed || typeof parsed !== "object") {
      return {};
    }
    return parsed;
  } catch {
    return {};
  }
}

function ToneIcon({ delta }: { delta?: string }) {
  if (!delta) {
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  }

  if (delta.trim().startsWith("-")) {
    return <ArrowDownRight className="h-3.5 w-3.5 text-rose-500" />;
  }

  return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-500" />;
}

function Sparkline({ values }: { values?: number[] }) {
  const bars = useMemo(() => {
    if (!values || values.length === 0) {
      return [];
    }

    const max = Math.max(...values, 1);
    return values.slice(-8).map((value) => Math.max(8, (value / max) * 100));
  }, [values]);

  if (bars.length === 0) {
    return null;
  }

  return (
    <div className="flex h-8 items-end gap-1">
      {bars.map((height, index) => (
        <span
          key={index}
          className="w-1.5 rounded-full bg-primary/70"
          style={{ height: `${height}%` }}
        />
      ))}
    </div>
  );
}

function CardToneClasses(tone?: ClaudeCardItem["tone"]) {
  switch (tone) {
    case "good":
      return "border-emerald-500/20 bg-emerald-500/5";
    case "bad":
      return "border-rose-500/20 bg-rose-500/5";
    case "accent":
      return "border-primary/20 bg-primary/5";
    default:
      return "border-border/60 bg-card/70";
  }
}

export function ClaudeCardsBlock({ configText }: { configText: string }) {
  const config = useMemo(() => safeParseConfig(configText), [configText]);
  const cards = Array.isArray(config.cards) ? config.cards : [];

  return (
    <div className="w-full overflow-hidden rounded-3xl border border-border/60 bg-background/70 p-4 shadow-sm md:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            Claude-style cards
          </div>
          <h3 className="text-xl font-semibold tracking-tight text-foreground">
            {config.title || "Visual summary"}
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {config.subtitle || "Compact cards for fast scanability and comparison."}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card, index) => (
          <Card key={`${card.label}-${index}`} className={cn("gap-0 py-0", CardToneClasses(card.tone))}>
            <CardHeader className="pb-3 pt-4">
              <CardDescription className="flex items-center gap-2 text-xs uppercase tracking-[0.12em]">
                <ToneIcon delta={card.delta} />
                {card.label}
              </CardDescription>
              <CardTitle className="text-2xl font-semibold text-foreground">
                {card.value ?? "Missing Data"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {card.benchmark ? (
                <div className="rounded-2xl border border-border/50 bg-background/40 px-3 py-2 text-xs text-muted-foreground">
                  Benchmark: <span className="font-medium text-foreground">{card.benchmark}</span>
                </div>
              ) : null}
              {card.note ? (
                <p className="text-sm leading-6 text-muted-foreground">{card.note}</p>
              ) : null}
              {card.delta ? (
                <p
                  className={cn(
                    "text-sm font-medium",
                    card.delta.trim().startsWith("-") ? "text-rose-500" : "text-emerald-500"
                  )}
                >
                  {card.delta}
                </p>
              ) : null}
              <Sparkline values={card.sparkline} />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
