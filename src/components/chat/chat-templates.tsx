"use client";

import { Button } from "@/components/ui/button";
import {
  Activity,
  BarChart3,
  CreditCard,
  DollarSign,
  FileText,
  Globe,
  IndianRupee,
  Instagram,
  Package,
  Search,
  ShieldAlert,
  ShoppingCart,
  Star,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getChatAgents,
  type ChatAgentId,
} from "@/lib/ai/chat-agents";

interface ChatTemplatesProps {
  onSelect: (prompt: string) => void;
  selectedAgentId?: ChatAgentId | null;
  onSelectAgent?: (agentId: ChatAgentId | null) => void;
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

const agentIcons: Record<ChatAgentId, React.ElementType> = {
  "weekly-brief": FileText,
  "performance-shift": Activity,
  "qbr-prep": Users,
  "competitor-research": Search,
  "retention-risk": ShieldAlert,
};

export function ChatTemplates({
  onSelect,
  selectedAgentId = null,
  onSelectAgent,
}: ChatTemplatesProps) {
  const agents = getChatAgents();
  const selectedAgent =
    agents.find((agent) => agent.id === selectedAgentId) ?? null;
  const visibleTemplates = selectedAgent
    ? selectedAgent.starterPrompts.map((starter) => ({
        icon: agentIcons[selectedAgent.id],
        label: starter.label,
        prompt: starter.prompt,
        category: selectedAgent.shortLabel,
      }))
    : templates;

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

      <div className="mt-10 w-full">
        <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant={selectedAgent ? "outline" : "default"}
            size="sm"
            className="rounded-full"
            onClick={() => onSelectAgent?.(null)}
          >
            General chat
          </Button>
          {selectedAgent ? (
            <span className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
              Active agent: {selectedAgent.name}
            </span>
          ) : null}
        </div>

        <div className="grid w-full gap-4 md:grid-cols-2 xl:grid-cols-3">
          {agents.map((agent) => {
            const Icon = agentIcons[agent.id];
            const isActive = agent.id === selectedAgentId;

            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => onSelectAgent?.(agent.id)}
                className={`group flex h-full flex-col items-start gap-3 rounded-2xl border p-5 text-left shadow-sm transition-all ${
                  isActive
                    ? "border-primary/50 bg-primary/10 shadow-md"
                    : "border-border/50 bg-card hover:scale-[1.01] hover:border-primary/40 hover:bg-accent/40"
                }`}
              >
                <div className="flex w-full items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="rounded-full border border-border/60 bg-background/70 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Agent
                  </span>
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{agent.name}</p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {agent.summary}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-12 w-full">
        <div className="mb-4 space-y-1 text-center">
          <p className="text-sm font-medium text-foreground">
            {selectedAgent ? `${selectedAgent.name} starter prompts` : "Starter prompts"}
          </p>
          <p className="text-sm text-muted-foreground">
            {selectedAgent
              ? "These prompts are tuned for the selected agent."
              : "Try one of these specialized analytics prompts."}
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
