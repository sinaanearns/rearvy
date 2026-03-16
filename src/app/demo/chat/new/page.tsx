"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Send, Youtube } from "lucide-react";

type DemoMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
};

const DEMO_FACTS = {
  youtubeSubs: 2_000_000,
  youtubeViews30d: 6_420_000,
  websiteViews: 1000,
  websiteVisitors: 420,
};

const DEMO_STARTER_PROMPTS = [
  "How many YouTube subscribers do we have?",
  "Show YouTube views for the last 30 days",
  "How much website traffic do we have?",
];

function getDemoReply(prompt: string): string {
  const p = prompt.toLowerCase();

  if (p.includes("youtube") && (p.includes("subs") || p.includes("subscriber"))) {
    return `Demo data: YouTube has ${DEMO_FACTS.youtubeSubs.toLocaleString()} subscribers.`;
  }

  if (p.includes("youtube") && p.includes("view")) {
    return `Demo data: YouTube views in the last 30 days are ${DEMO_FACTS.youtubeViews30d.toLocaleString()}.`;
  }

  if (p.includes("website") || p.includes("traffic")) {
    return `Demo data: website has ${DEMO_FACTS.websiteViews.toLocaleString()} views and ${DEMO_FACTS.websiteVisitors.toLocaleString()} unique visitors.`;
  }

  return "Demo mode: integrations are already connected with sample YouTube and Website data. Ask for subscribers, views, or traffic.";
}

export default function DemoNewChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<DemoMessage[]>([
    {
      id: "demo-welcome",
      role: "assistant",
      text: "Hi, I am your Rearvy demo AI assistant. Demo integrations are already connected: YouTube (2,000,000 subscribers) and Website (1,000 views). Ask me anything about this demo data.",
    },
  ]);

  const handleSend = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: DemoMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const assistantMessage: DemoMessage = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      text: getDemoReply(trimmed),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <div className="flex h-[calc(100vh-7rem)] min-h-0 flex-col">
      <div className="mb-3 flex flex-wrap gap-2 px-2 sm:px-0">
        <Badge variant="secondary" className="gap-1.5">
          <Youtube className="h-3.5 w-3.5" /> YouTube connected (2,000,000 subscribers)
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Globe className="h-3.5 w-3.5" /> Website connected (1,000 views)
        </Badge>
      </div>

      <div className="flex-1 overflow-y-auto scroll-smooth">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-3 pb-10 pt-2 sm:px-6 sm:pt-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                  message.role === "user"
                    ? "rounded-tr-sm bg-primary text-primary-foreground"
                    : "rounded-tl-sm border bg-card"
                }`}
              >
                {message.text}
              </div>
            </div>
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
            placeholder="Ask about demo YouTube or website data..."
          />
          <Button type="submit">
            <Send className="h-4 w-4" />
            Send
          </Button>
        </form>
      </div>
    </div>
  );
}
