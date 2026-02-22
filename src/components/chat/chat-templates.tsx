"use client";

import { Button } from "@/components/ui/button";
import {
  DollarSign,
  Package,
  ShoppingCart,
  TrendingUp,
  BarChart3,
  Users,
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
];

export function ChatTemplates({ onSelect }: ChatTemplatesProps) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center justify-center py-12 text-center">
      <h2 className="text-xl font-semibold">What can I help with?</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Ask me anything about your business, or try one of these
      </p>

      <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
        {templates.map((template) => (
          <Button
            key={template.label}
            variant="outline"
            className="h-auto flex-col items-start gap-1 p-4 text-left"
            onClick={() => onSelect(template.prompt)}
          >
            <div className="flex items-center gap-2">
              <template.icon className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium">{template.label}</span>
            </div>
            <span className="text-xs text-muted-foreground line-clamp-1">
              {template.prompt}
            </span>
          </Button>
        ))}
      </div>
    </div>
  );
}
