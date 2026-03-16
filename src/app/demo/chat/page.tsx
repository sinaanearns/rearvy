"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Globe, Send, Youtube } from "lucide-react";

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

const DEMO_FACTS = {
  youtubeSubs: 2_000_000,
  youtubeViews30d: 6_420_000,
  websiteViews: 1000,
  websiteVisitors: 420,
};

function getDemoReply(prompt: string): string {
  const p = prompt.toLowerCase();

  if (p.includes("youtube") && (p.includes("subs") || p.includes("subscriber"))) {
    return `Demo data: your YouTube channel has ${DEMO_FACTS.youtubeSubs.toLocaleString()} subscribers.`;
  }

  if (p.includes("youtube") && p.includes("view")) {
    return `Demo data: YouTube total views in the last 30 days are ${DEMO_FACTS.youtubeViews30d.toLocaleString()}.`;
  }

  if (p.includes("website") && (p.includes("view") || p.includes("traffic"))) {
    return `Demo data: website views are ${DEMO_FACTS.websiteViews.toLocaleString()} with ${DEMO_FACTS.websiteVisitors.toLocaleString()} unique visitors.`;
  }

  if (p.includes("integrated") || p.includes("integration") || p.includes("connect")) {
    return "Demo integrations are already active in this chat: YouTube and Website sample data are connected.";
  }

  return "Demo mode reply: I can answer using sample integrated data. Try asking about YouTube subscribers, YouTube views, or website traffic.";
}

export default function DemoChatPage() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      text: "Welcome to Rearvy demo chat. Demo data is already integrated: YouTube and Website metrics are active.",
    },
  ]);

  const suggestions = useMemo(
    () => [
      "How many YouTube subscribers do we have?",
      "Show YouTube views for the last 30 days",
      "How much website traffic do we have?",
    ],
    []
  );

  const sendMessage = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      text: trimmed,
    };

    const assistantMessage: ChatMessage = {
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      role: "assistant",
      text: getDemoReply(trimmed),
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput("");
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Demo chat</h1>
        <p className="mt-1 text-muted-foreground">
          Single demo conversation with pre-integrated sample data. No login required.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="gap-1.5">
          <Youtube className="h-3.5 w-3.5" /> YouTube connected (2,000,000 subscribers)
        </Badge>
        <Badge variant="secondary" className="gap-1.5">
          <Globe className="h-3.5 w-3.5" /> Website connected (1,000 views)
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conversation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="max-h-[430px] space-y-3 overflow-y-auto rounded-xl border bg-muted/20 p-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user"
                      ? "rounded-tr-sm bg-primary text-primary-foreground"
                      : "rounded-tl-sm border bg-card"
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Button
                key={s}
                type="button"
                variant="outline"
                size="sm"
                onClick={() => sendMessage(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(input);
            }}
          >
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about demo YouTube or website metrics..."
            />
            <Button type="submit">
              <Send className="h-4 w-4" />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
