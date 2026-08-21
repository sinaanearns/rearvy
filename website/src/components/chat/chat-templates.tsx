"use client";

import { Button } from "@/components/ui/button";
import { CLIENT_FINDER_PROMPT } from "./chat-prompts";
import {
  Search,
  BarChart3,
  Package,
  ShoppingCart,
  Users,
  Palette,
  MapPinned,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatTemplatesProps {
  onSelect: (prompt: string) => void;
}

const templates = [
  {
    icon: Search,
    label: "Research competitors",
    prompt:
      "Open the browser and research my top competitors. Capture useful pages, cite sources, and summarize what to copy or avoid.",
  },
  {
    icon: Users,
    label: "Find clients",
    prompt: CLIENT_FINDER_PROMPT,
  },
  {
    icon: MapPinned,
    label: "Map locations",
    prompt:
      "Show me JP Morgan company locations on a map. Generate a city-level location footprint and explain that it is a sample, not an exhaustive office locator.",
  },
  {
    icon: Palette,
    label: "Design product",
    prompt:
      "Design a premium product concept for my brand with positioning, visuals, and launch steps.",
  },
  {
    icon: Package,
    label: "Fix workflow",
    prompt:
      "Inspect the current app workflow, find the issue, and continue with the safest next action.",
  },
  {
    icon: ShoppingCart,
    label: "Check orders",
    prompt: "Show my recent orders and flag anything that needs action.",
  },
  {
    icon: BarChart3,
    label: "Check numbers",
    prompt:
      "How much did we do this month? Break it down by connected channels and payment methods.",
  },
];

export function ChatTemplates({ onSelect }: ChatTemplatesProps) {
  return (
    <div className="mx-auto flex min-h-[52vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-12 text-center">
      <div className="space-y-2">
        <h2 className="text-3xl font-semibold tracking-normal text-foreground sm:text-4xl">
          What should I do?
        </h2>
        <p className="mx-auto max-w-xl text-sm leading-6 text-muted-foreground">
          Start from a real agency workflow, then Rearvy can research, design, inspect, or operate from chat.
        </p>
      </div>

      <div className="mt-8 w-full">
        <div className="grid w-full gap-2.5 sm:grid-cols-2">
          {templates.map((template, index) => (
            <Button
              key={template.label}
              variant="outline"
              className={cn(
                "group h-auto min-h-16 justify-start gap-3 whitespace-normal rounded-[8px] border-border/70 bg-card/85 px-3.5 py-3 text-left text-sm font-medium shadow-sm shadow-slate-950/[0.03] transition-all hover:-translate-y-0.5 hover:border-primary/30 hover:bg-card",
                index === 0 && "sm:col-span-2"
              )}
              onClick={() => onSelect(template.prompt)}
              aria-label={template.label}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-border/60 bg-background text-muted-foreground shadow-sm transition-colors group-hover:text-primary">
                <template.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate font-semibold text-foreground">{template.label}</span>
                <span className="mt-0.5 block truncate text-xs font-normal text-muted-foreground">
                  {template.prompt}
                </span>
              </span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
