"use client";

import { useMemo, useRef, useState, useEffect } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Globe, Send, Square, Youtube } from "lucide-react";

type DemoChatMessage = UIMessage;

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

export default function DemoNewChatPage() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState("");
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat/demo",
      }),
    []
  );

  const initialMessages: DemoChatMessage[] = useMemo(
    () => [
      {
        id: "demo-welcome",
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "Hi, I am your Rearvy demo AI assistant. Demo integrations are already connected: YouTube (2,000,000 subscribers) and Website (1,000 views). Ask me anything about this demo data.",
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
            placeholder="Ask about demo YouTube or website data..."
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
  );
}
