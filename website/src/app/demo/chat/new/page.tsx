"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  BarChart3,
  Check,
  Globe,
  Instagram,
  Send,
  ShoppingBag,
  Sparkles,
  Square,
  Store,
  UserRound,
  Youtube,
} from "lucide-react";

type DemoChatMessage = UIMessage;

type DemoIntegrationSlug = "youtube" | "website" | "shopify" | "instagram";

const DEMO_FACTS = {
  youtubeSubs: 2_000_000,
  youtubeViews30d: 6_420_000,
  websiteViews: 1000,
  websiteVisitors: 420,
};

const DEMO_INTEGRATIONS: Array<{
  slug: DemoIntegrationSlug;
  title: string;
  detail: string;
  icon: React.ElementType;
}> = [
  {
    slug: "youtube",
    title: "YouTube",
    detail: "2,000,000 subscribers",
    icon: Youtube,
  },
  {
    slug: "website",
    title: "Website",
    detail: "1,000 views",
    icon: Globe,
  },
  {
    slug: "shopify",
    title: "Shopify",
    detail: "728 demo orders",
    icon: ShoppingBag,
  },
  {
    slug: "instagram",
    title: "Instagram",
    detail: "180k followers",
    icon: Instagram,
  },
];

const DEMO_STARTER_PROMPTS = [
  "Tell me about me and my business",
  "How many YouTube subscribers do we have?",
  "Show YouTube views for the last 30 days",
  "How much website traffic do we have?",
];

const DEMO_PROFILE = {
  ownerName: "Sarah Johnson",
  role: "Founder & CEO",
  businessName: "Luma Naturals",
  businessType: "Skincare ecommerce brand",
  location: "Austin, Texas",
  teamSize: "12 people",
  stage: "Growth stage",
  summary:
    "Luma Naturals is a fast-growing skincare brand selling direct-to-consumer through Shopify, content marketing, and social channels.",
};

export default function DemoNewChatPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const [selectedIntegrations, setSelectedIntegrations] = useState<DemoIntegrationSlug[]>([
    "youtube",
    "website",
  ]);

  const selectedMeta = useMemo(
    () =>
      DEMO_INTEGRATIONS.filter((integration) =>
        selectedIntegrations.includes(integration.slug)
      ),
    [selectedIntegrations]
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/demo",
        body: {
          selectedIntegrations,
        },
      }),
    [selectedIntegrations]
  );

  const initialMessages: DemoChatMessage[] = useMemo(
    () => [
      {
        id: "demo-welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: `Hi, I am your Rearvy demo AI assistant. You are ${DEMO_PROFILE.ownerName}, ${DEMO_PROFILE.role} at ${DEMO_PROFILE.businessName}. Demo integrations are already connected: YouTube (2,000,000 subscribers) and Website (1,000 views). Ask me anything about your demo business or data.`,
          },
        ],
      },
    ],
    []
  );

  const { messages, sendMessage, status, stop } = useChat<DemoChatMessage>({
    transport,
    messages: initialMessages,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const selectedSignalCount = selectedIntegrations.length;

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    sendMessage({ text: trimmed });
    setInput("");
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const toggleIntegration = (slug: DemoIntegrationSlug) => {
    setSelectedIntegrations((current) => {
      if (current.includes(slug)) {
        return current.filter((item) => item !== slug);
      }

      return [...current, slug];
    });
  };

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <aside className="hidden shrink-0 lg:block">
        <Card className="mb-4 overflow-hidden rounded-[8px] border-white/10 bg-white/[0.07] text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              Demo business
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-black/24 px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-cyan-200/16 bg-cyan-200/10 text-cyan-100">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{DEMO_PROFILE.ownerName}</p>
                <p className="text-xs text-white/52">{DEMO_PROFILE.role}</p>
              </div>
            </div>

            <div className="rounded-[8px] border border-white/10 bg-black/24 px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Store className="h-4 w-4 text-cyan-100" />
                <p className="text-sm font-medium">{DEMO_PROFILE.businessName}</p>
              </div>
              <p className="text-xs text-white/52">{DEMO_PROFILE.businessType}</p>
              <p className="mt-2 text-xs leading-5 text-white/58">{DEMO_PROFILE.summary}</p>
              <div className="mt-3 grid gap-2 text-xs text-white/58">
                {[
                  ["Location", DEMO_PROFILE.location],
                  ["Team", DEMO_PROFILE.teamSize],
                  ["Stage", DEMO_PROFILE.stage],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 border-t border-white/10 pt-2">
                    <span className="text-white/38">{label}</span>
                    <span className="font-medium text-white/72">{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ["YouTube views", DEMO_FACTS.youtubeViews30d.toLocaleString()],
                ["Visitors", DEMO_FACTS.websiteVisitors.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-lg font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.12em] text-white/42">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border-white/10 bg-white/[0.07] text-white shadow-2xl shadow-black/20 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4 text-emerald-200" />
              Demo integrations
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_INTEGRATIONS.map((integration) => {
              const active = selectedIntegrations.includes(integration.slug);
              const Icon = integration.icon;

              return (
                <button
                  key={integration.slug}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-[8px] border px-3 py-2.5 text-left transition-all hover:-translate-y-0.5 ${
                    active
                      ? "border-cyan-200/35 bg-cyan-200/10 shadow-sm shadow-cyan-950/20"
                      : "border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/[0.08]"
                  }`}
                  onClick={() => toggleIntegration(integration.slug)}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-[8px] border ${
                      active ? "border-cyan-200/20 bg-cyan-200/12 text-cyan-100" : "border-white/10 bg-white/[0.06] text-white/62"
                    }`}
                  >
                    {active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{integration.title}</p>
                    <p className="truncate text-xs text-white/48">{integration.detail}</p>
                  </div>
                </button>
              );
            })}

            <p className="pt-1 text-xs leading-5 text-white/48">
              Select what the demo AI can use in this chat.
            </p>
          </CardContent>
        </Card>
      </aside>

      <div className="flex h-[calc(100vh-7rem)] min-h-0 min-w-0 flex-col overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.07] shadow-2xl shadow-black/20 backdrop-blur-xl">
        <div className="border-b border-white/10 bg-black/24 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100/78">
                <Activity className="h-3.5 w-3.5" />
                Live demo chat
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                Ask Rearvy about a connected DTC brand
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm sm:flex">
              {[
                [selectedSignalCount, "Signals"],
                [messages.length, "Messages"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2">
                  <p className="text-lg font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-[0.14em] text-white/44">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
          {selectedMeta.map((integration) => {
            const Icon = integration.icon;
            return (
              <Badge
                key={integration.slug}
                variant="secondary"
                className="gap-1.5 rounded-full border border-cyan-200/18 bg-cyan-200/10 px-3 py-1 text-cyan-50"
              >
                <Icon className="h-3.5 w-3.5" /> {integration.title} connected ({integration.detail})
              </Badge>
            );
          })}
          {selectedMeta.length === 0 && (
            <Badge variant="outline" className="rounded-full border-white/20 text-white/62">
              No demo integrations selected
            </Badge>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth bg-slate-950/16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-3 pb-10 pt-5 sm:px-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#0d1117]/88 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-5">
          <div className="mx-auto mb-3 flex w-full max-w-4xl flex-wrap gap-2">
            {DEMO_STARTER_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 rounded-full border-white/14 bg-white/[0.06] text-xs text-white/72 hover:bg-white hover:text-black"
                onClick={() => handleSend(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
          <form
            className="mx-auto flex w-full max-w-4xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={isLoading}
              placeholder="Ask about selected demo integrations..."
              className="h-12 rounded-[8px] border-white/14 bg-white/[0.08] text-white placeholder:text-white/38 focus-visible:bg-white/12"
            />
            {isLoading ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-[8px] border-white/20 bg-transparent px-4 text-white hover:bg-white hover:text-black"
                onClick={stop}
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!input.trim()}
                className="h-12 rounded-[8px] bg-white px-4 font-semibold text-black hover:bg-white/85"
              >
                <Send className="h-4 w-4" />
                Send
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
