"use client";

import { Button } from "@/components/ui/button";
import { Search, IndianRupee, CreditCard, BarChart3, TrendingUp, Package, ShoppingCart, DollarSign, Users, Instagram, Star } from "lucide-react";

interface ChatTemplatesProps {
  onSelect: (prompt: string) => void;
}

const templates = [

  {
    icon: Search,
    label: "Research with sources",
    prompt:
      "Research our competitors on the web and cite the sources you use.",
    category: "Research",
  },
  {
    icon: IndianRupee,
    label: "Monthly collections",
    prompt: "How much did we do this month? Show Shopify and Razorpay separately.",
    category: "Sales",
  },
  {
    icon: CreditCard,
    label: "Shopify vs UPI",
    prompt: "Break this month into Shopify vs UPI.",
    category: "Payments",
  },
  {
    icon: BarChart3,
    label: "Payment method mix",
    prompt: "Which Razorpay payment method brought the most money this month?",
    category: "Payments",
  },
  {
    icon: TrendingUp,
    label: "UPI growth",
    prompt: "Is direct UPI growing faster than Shopify?",
    category: "Payments",
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
    icon: DollarSign,
    label: "Revenue check",
    prompt: "How is my revenue looking this month compared to last month?",
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

export function ChatTemplates({
  onSelect,
}: ChatTemplatesProps) {
  const visibleTemplates = templates;

  return (
    <div className="mx-auto flex max-w-5xl flex-col items-center justify-center px-4 py-16 text-center">
      <div className="space-y-3">
        <h2 className="text-4xl font-extrabold tracking-tight text-foreground lg:text-5xl">
          What can I help with?
        </h2>
        <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
          Pick a repeat agency job or start with a specialized prompt.
        </p>
      </div>

      <div className="mt-12 w-full">
        <div className="mb-4 space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">
            Starter prompts
          </p>
          <p className="text-sm text-muted-foreground">
            Try one of these specialized analytics prompts.
          </p>
        </div>

        <div className="grid w-full max-w-4xl gap-6 sm:grid-cols-2 lg:gap-8">
          {visibleTemplates.map((template) => (
            <Button
              key={`${template.category}-${template.label}`}
              variant="outline"
              className="group flex h-full flex-col items-start gap-3 whitespace-normal rounded-2xl border-border/50 bg-card p-6 text-left shadow-sm transition-all hover:scale-[1.02] hover:border-primary/50 hover:bg-accent/50 hover:shadow-md"
              onClick={() => onSelect(template.prompt)}
            >
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary/20">
                    <template.icon className="h-5 w-5 text-primary" />
                  </div>
                  <span className="text-lg font-bold transition-colors group-hover:text-primary">
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
    </div>
  );
}
