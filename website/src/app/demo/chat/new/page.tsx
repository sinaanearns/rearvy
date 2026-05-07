"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Check, Globe, Instagram, Send, ShoppingBag, Square, Store, UserRound, Youtube } from "lucide-react";

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
    <div className="flex min-h-0 gap-4">
      <aside className="hidden w-72 shrink-0 lg:block">
        <Card className="mb-4">
          <CardHeader>
            <CardTitle className="text-base">Demo business</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-3 rounded-lg border px-3 py-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                <UserRound className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium">{DEMO_PROFILE.ownerName}</p>
                <p className="text-xs text-muted-foreground">{DEMO_PROFILE.role}</p>
              </div>
            </div>

            <div className="rounded-lg border px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Store className="h-4 w-4" />
                <p className="text-sm font-medium">{DEMO_PROFILE.businessName}</p>
              </div>
              <p className="text-xs text-muted-foreground">{DEMO_PROFILE.businessType}</p>
              <p className="mt-2 text-xs text-muted-foreground">{DEMO_PROFILE.summary}</p>
              <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                <p>Location: {DEMO_PROFILE.location}</p>
                <p>Team size: {DEMO_PROFILE.teamSize}</p>
                <p>Stage: {DEMO_PROFILE.stage}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Demo integrations</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_INTEGRATIONS.map((integration) => {
              const active = selectedIntegrations.includes(integration.slug);
              const Icon = integration.icon;

              return (
                <button
                  key={integration.slug}
                  type="button"
                  className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors ${
                    active
                      ? "border-primary/60 bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggleIntegration(integration.slug)}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-md ${
                      active ? "bg-primary/20" : "bg-muted"
                    }`}
                  >
                    {active ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{integration.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{integration.detail}</p>
                  </div>
                </button>
              );
            })}

            <p className="pt-1 text-xs text-muted-foreground">
              Select what the demo AI can use in this chat.
            </p>
          </CardContent>
        </Card>
      </aside>

      <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-1 flex-col">
        <div className="mb-3 flex flex-wrap gap-2 px-2 sm:px-0">
          {selectedMeta.map((integration) => {
            const Icon = integration.icon;
            return (
              <Badge key={integration.slug} variant="secondary" className="gap-1.5">
                <Icon className="h-3.5 w-3.5" /> {integration.title} connected ({integration.detail})
              </Badge>
            );
          })}
          {selectedMeta.length === 0 && (
            <Badge variant="outline">No demo integrations selected</Badge>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-3 pb-10 pt-2 sm:px-6 sm:pt-4">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>
        </div>

        <div className="border-t border-border/70 bg-background/85 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-6">
          <div className="mx-auto mb-3 flex w-full max-w-4xl flex-wrap gap-2">
            {DEMO_STARTER_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                type="button"
                variant="outline"
                size="sm"
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
            />
            {isLoading ? (
              <Button type="button" variant="outline" onClick={stop}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button type="submit" disabled={!input.trim()}>
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
