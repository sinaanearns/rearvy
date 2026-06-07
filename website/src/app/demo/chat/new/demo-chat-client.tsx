"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageBubble } from "@/components/chat/message-bubble";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Activity,
  Bot,
  Globe,
  Monitor,
  Send,
  ShoppingBag,
  Sparkles,
  Square,
  Store,
} from "lucide-react";
import type { ChangeEvent, ElementType, FormEvent } from "react";

type DemoChatMessage = UIMessage;

const DEMO_EXAMPLE_TOPICS: Array<{
  slug: string;
  title: string;
  label: string;
  detail: string;
  prompt: string;
  icon: ElementType;
}> = [
  {
    slug: "maria",
    title: "Maria",
    label: "Example topic",
    detail:
      "Ask how the AI assistant would research, draft, summarize, or prepare a business action for approval.",
    prompt: "Show me an example of how Maria would help with a business workflow.",
    icon: Bot,
  },
  {
    slug: "desktop-access",
    title: "Desktop Access",
    label: "Example topic",
    detail:
      "Ask what a local desktop bridge can do, when permission is needed, and how computer control is handled.",
    prompt: "Give me an example of what Desktop Access can do after I approve it.",
    icon: Monitor,
  },
  {
    slug: "website",
    title: "Website",
    label: "Example topic",
    detail:
      "Ask how the browser app handles sign-up, chat, integrations, downloads, and workspace access.",
    prompt: "Show me an example of what someone can do from the Rearvy website.",
    icon: Globe,
  },
];

const INITIAL_DEMO_MESSAGES: DemoChatMessage[] = [
  {
    id: "demo-welcome",
    role: "assistant",
    parts: [
      {
        type: "text",
        text: "Hi, I am the Rearvy demo. Ask what Rearvy does, how the website and desktop app work, or try one of the example topics on this page.",
      },
    ],
  },
];

const DEMO_STARTER_CARDS = [
  {
    title: "Plan client work",
    detail: "Turn a rough ask into tasks, drafts, and review steps.",
    prompt: "Show how Rearvy turns a rough client request into a plan.",
    icon: Sparkles,
  },
  {
    title: "Use the browser",
    detail: "Preview how web access fits into the assistant workflow.",
    prompt: "Show how Rearvy can use browser context in a workflow.",
    icon: Globe,
  },
  {
    title: "Connect desktop",
    detail: "See what changes when the desktop bridge is available.",
    prompt: "Explain the desktop bridge and what it lets Maria do.",
    icon: Monitor,
  },
] as const;

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

  const { messages, sendMessage, status, stop } = useChat<DemoChatMessage>({
    transport,
    messages: INITIAL_DEMO_MESSAGES,
  });

  const isLoading = status === "submitted" || status === "streaming";
  const canSend = input.trim().length > 0 && !isLoading;

  const handleSend = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    void sendMessage({ text: trimmed });
    setInput("");
  }, [isLoading, sendMessage]);

  const handleInputChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    setInput(event.target.value);
  }, []);

  const handleSubmit = useCallback((event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSend(input);
  }, [handleSend, input]);

  const handleStop = useCallback(() => {
    void stop();
  }, [stop]);

  useEffect(() => {
    const scrollContainer = scrollRef.current;
    if (scrollContainer) {
      scrollContainer.scrollTop =
        messages.length <= INITIAL_DEMO_MESSAGES.length ? 0 : scrollContainer.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div className="grid min-h-0 w-full max-w-[calc(100vw-2rem)] gap-4 overflow-hidden sm:max-w-none lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start">
      <aside className="hidden shrink-0 pr-1 lg:block lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        <Card className="mb-4 overflow-hidden rounded-[8px] border-white/10 bg-white/[0.07] text-white shadow-sm shadow-black/20 backdrop-blur-xl">
          <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-amber-300" />
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-4 w-4 text-cyan-200" />
              Demo guide
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-[8px] border border-white/10 bg-black/24 px-3 py-3">
              <div className="mb-2 flex items-center gap-2">
                <Store className="h-4 w-4 text-cyan-100" aria-hidden="true" />
                <p className="text-sm font-medium">Use examples as starting points</p>
              </div>
              <p className="text-xs leading-5 text-white/70">
                These sample topics help visitors test the demo. They are examples, not the full
                product map or live account data.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                ["Examples", DEMO_EXAMPLE_TOPICS.length.toString()],
                ["Mode", "Chat"],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
                  <p className="text-lg font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/62">{label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border-white/10 bg-white/[0.07] text-white shadow-sm shadow-black/20 backdrop-blur-xl">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <ShoppingBag className="h-4 w-4 text-emerald-200" />
              Example topics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {DEMO_EXAMPLE_TOPICS.map((topic) => {
              const Icon = topic.icon;

              return (
                <button
                  key={topic.slug}
                  type="button"
                  disabled={isLoading}
                  onClick={() => handleSend(topic.prompt)}
                  className="flex w-full items-start gap-3 rounded-[8px] border border-white/10 bg-black/20 px-3 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-cyan-200/28 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/12 text-cyan-100">
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{topic.title}</p>
                      <span className="rounded-[8px] border border-white/10 bg-white/[0.06] px-2 py-1 text-[11px] font-medium text-white/64">
                        {topic.label}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-white/66">{topic.detail}</p>
                  </div>
                </button>
              );
            })}

            <p className="pt-1 text-xs leading-5 text-white/60">
              Selecting one sends a sample prompt into this demo chat.
            </p>
          </CardContent>
        </Card>
      </aside>

      <section className="min-w-0 rounded-[8px] border border-white/10 bg-white/[0.07] p-3 text-white shadow-sm shadow-black/20 backdrop-blur-xl lg:hidden">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold">Try a guided example</p>
            <p className="mt-1 text-xs leading-5 text-white/64">
              Start the demo with a common Rearvy workflow.
            </p>
          </div>
          <Sparkles className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden="true" />
        </div>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {DEMO_EXAMPLE_TOPICS.map((topic) => {
            const Icon = topic.icon;

            return (
              <button
                key={topic.slug}
                type="button"
                disabled={isLoading}
                onClick={() => handleSend(topic.prompt)}
                className="grid min-w-[210px] grid-cols-[34px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-cyan-200/18 bg-black/22 px-3 py-3 text-left transition-all hover:border-cyan-200/32 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/12 text-cyan-100">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">
                    {topic.title}
                  </span>
                  <span className="mt-0.5 block truncate text-[11px] font-medium text-white/64">
                    {topic.label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <div className="flex h-[calc(100svh-17rem)] max-h-[760px] min-h-[520px] min-w-0 max-w-full flex-col overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.07] shadow-sm shadow-black/20 backdrop-blur-xl lg:h-[calc(100vh-7rem)] lg:max-h-none">
        <div className="border-b border-white/10 bg-black/24 px-4 py-4 sm:px-5">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-sm font-medium text-cyan-100/84">
                <Activity className="h-3.5 w-3.5" />
                Live demo chat
              </div>
              <h1 className="mt-2 max-w-full break-words text-2xl font-semibold text-white">
                Try the Rearvy demo
              </h1>
            </div>
            <div className="grid min-w-0 grid-cols-2 gap-2 text-sm sm:flex">
              {[
                [DEMO_EXAMPLE_TOPICS.length, "Examples"],
                [messages.length, "Messages"],
              ].map(([value, label]) => (
                <div key={label} className="rounded-[8px] border border-white/10 bg-white/[0.06] px-3 py-2">
                  <p className="text-lg font-semibold leading-none text-white">{value}</p>
                  <p className="mt-1 text-[11px] font-medium text-white/62">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-white/10 px-4 py-3 sm:px-5">
          {DEMO_EXAMPLE_TOPICS.map((topic) => {
            const Icon = topic.icon;
            return (
              <Badge
                key={topic.slug}
                variant="secondary"
                className="gap-1.5 rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 px-3 py-1 text-cyan-50"
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" /> Example: {topic.title}
              </Badge>
            );
          })}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scroll-smooth bg-slate-950/16">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-3 pb-10 pt-5 sm:px-6">
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}

            {messages.length <= INITIAL_DEMO_MESSAGES.length && !isLoading ? (
              <section className="hidden rounded-[8px] border border-white/10 bg-white/[0.055] p-2 text-white shadow-sm shadow-black/15 backdrop-blur-xl md:block">
                <div className="flex flex-col gap-1.5 border-b border-white/10 pb-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">
                      Start with a demo path
                    </p>
                    <p className="mt-1 text-xs leading-5 text-white/62">
                      Pick a workflow and the prompt is sent into this chat.
                    </p>
                  </div>
                  <Sparkles className="h-4 w-4 shrink-0 text-cyan-200" aria-hidden />
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {DEMO_STARTER_CARDS.map((card) => {
                    const Icon = card.icon;

                    return (
                      <button
                        key={card.title}
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleSend(card.prompt)}
                        className="group grid min-h-[74px] grid-cols-[32px_minmax(0,1fr)] gap-2.5 rounded-[8px] border border-white/10 bg-black/24 p-2.5 text-left transition hover:border-cyan-200/32 hover:bg-cyan-200/10 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 text-cyan-100 transition group-hover:border-cyan-200/34 group-hover:bg-cyan-200/14">
                          <Icon className="h-4 w-4" aria-hidden />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-white">
                            {card.title}
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-white/62">
                            {card.detail}
                          </span>
                          <span className="mt-1 block text-xs font-semibold text-cyan-100/84">
                            Send prompt
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {isLoading && messages[messages.length - 1]?.role === "user" ? (
              <MessageBubble
                key="pending-assistant"
                message={{ id: "pending", role: "assistant", parts: [] } as DemoChatMessage}
                isLoading
              />
            ) : null}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#0d1117]/88 px-3 pb-5 pt-4 backdrop-blur-xl sm:px-5">
          <form
            className="mx-auto flex w-full min-w-0 max-w-4xl gap-2"
            onSubmit={handleSubmit}
          >
            <Input
              value={input}
              onChange={handleInputChange}
              disabled={isLoading}
              placeholder="Ask Rearvy or try an example..."
              className="h-12 min-w-0 flex-1 rounded-[8px] border-white/14 bg-white/[0.08] text-white placeholder:text-white/52 focus-visible:bg-white/12"
            />
            {isLoading ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 shrink-0 rounded-[8px] border-white/20 bg-transparent px-3 text-white hover:bg-white/10 hover:text-white sm:px-4"
                onClick={handleStop}
                aria-label="Stop response"
              >
                <Square className="h-4 w-4" />
                <span className="hidden sm:inline">Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={!canSend}
                className="h-12 shrink-0 rounded-[8px] bg-white px-3 font-semibold text-black hover:bg-white/85 sm:px-4"
                aria-label="Send message"
              >
                <Send className="h-4 w-4" />
                <span className="hidden sm:inline">Send</span>
              </Button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
