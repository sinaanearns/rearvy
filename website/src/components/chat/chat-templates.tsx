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
} from "lucide-react";

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
      </div>

      <div className="mt-8 w-full">
        <div className="grid w-full gap-2 sm:grid-cols-2">
          {templates.map((template) => (
            <Button
              key={template.label}
              variant="outline"
              className="group h-14 justify-start gap-3 whitespace-normal rounded-lg border-border/70 bg-background px-4 text-left text-sm font-medium shadow-none transition-colors hover:border-foreground/30 hover:bg-accent"
              onClick={() => onSelect(template.prompt)}
              aria-label={template.label}
            >
              <template.icon className="h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
              <span className="min-w-0 truncate">{template.label}</span>
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
