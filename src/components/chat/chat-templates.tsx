"use client";

import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Users,
  Instagram,
  Star,
} from "lucide-react";

interface ChatTemplatesProps {
  onSelect: (prompt: string) => void;
}

const templates = [
  {
    icon: DollarSign,
    label: "Revenue check",
    prompt: "How is my revenue looking this month compared to last month?",
    category: "Sales",
  },
  {
    icon: Package,
    label: "Top products",
    prompt: "What are my top 5 products by revenue this month?",
    category: "Products",
  },
  {
    icon: ShoppingCart,
    label: "Recent orders",
    prompt: "Show me my recent orders and their status.",
    category: "Sales",
  },
  {
    icon: TrendingUp,
    label: "Growth ideas",
    prompt:
      "Based on my data, what are 3 actionable growth strategies I should try?",
    category: "Strategy",
  },
  {
    icon: BarChart3,
    label: "Inventory status",
    prompt: "Are any of my products low on stock or out of stock?",
    category: "Products",
  },
  {
    icon: Users,
    label: "Customer analysis",
    prompt:
      "Tell me about my customers - who are my top spenders and what's my repeat rate?",
    category: "Customers",
  },
  {
    icon: Instagram,
    label: "Social media overview",
    prompt:
      "How is my social media performing? Show me engagement across all connected platforms.",
    category: "Social",
  },
  {
    icon: Star,
    label: "Product reviews",
    prompt:
      "What do my product reviews look like? Show me the overall rating and any common complaints.",
    category: "Products",
  },
];

export function ChatTemplates({ onSelect }: ChatTemplatesProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center justify-center py-16 px-4 text-center">
      <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
          What can I help with?
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Ask me anything about your business, or try one of these specialized analytics templates.
        </p>
      </div>

      <div className="mt-12 grid w-full max-w-4xl gap-6 sm:grid-cols-2 lg:gap-8">
        {templates.map((template) => (
          <Button
            key={template.label}
            variant="outline"
            className="group flex h-full flex-col items-start gap-3 rounded-2xl border-border/50 bg-card p-6 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
            onClick={() => onSelect(template.prompt)}
          >
            <div className="flex w-full items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <template.icon className="h-5 w-5 text-primary" />
                </div>
                <span className="text-lg font-bold group-hover:text-primary transition-colors">
                  {template.label}
                </span>
              </div>
            </div>
            <span className="text-sm leading-relaxed text-muted-foreground">
              {template.prompt}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
