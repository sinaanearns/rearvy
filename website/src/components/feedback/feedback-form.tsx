"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Bug,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquareHeart,
  Send,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readFeedbackResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    error: typeof payload.error === "string" ? payload.error : undefined,
  };
}

const feedbackPrompts = [
  {
    title: "What happened",
    detail: "Name the workflow, page, or action that did not behave as expected.",
    icon: Bug,
  },
  {
    title: "Expected result",
    detail: "Describe the outcome you wanted Rearvy to produce.",
    icon: CheckCircle2,
  },
  {
    title: "Useful evidence",
    detail: "Include exact text, screenshots, or steps if they make the issue repeatable.",
    icon: ClipboardList,
  },
];

export function FeedbackForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourcePage = searchParams?.get("from") || "/feedback";
  const sourcePath = sourcePage.split("?")[0];
  const messageProgress = Math.min(100, Math.round((message.length / 1000) * 100));

  async function handleSubmit() {
    const trimmedMessage = message.trim();

    if (!trimmedMessage) {
      toast.error("Enter a short message before sending feedback.");
      return;
    }

    if (!user) {
      toast.error("You need to be signed in to send feedback.");
      return;
    }

    setIsSubmitting(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dashboard/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: "feedback",
          message: trimmedMessage,
          page: sourcePage,
        }),
      });

      const data = await readFeedbackResponse(response);

      if (!response.ok) {
        throw new Error(data.error || "Failed to send feedback.");
      }

      setMessage("");
      toast.success("Feedback sent successfully!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send feedback.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <div className="overflow-hidden rounded-[8px] border border-slate-800 bg-slate-950 shadow-sm shadow-slate-950/35">
        <div className="grid min-h-[620px] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),transparent_34%),linear-gradient(315deg,rgba(244,63,94,0.18),transparent_28%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />

            <div className="relative space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-white/14 bg-white/10 text-cyan-100 shadow-sm shadow-black/25">
                <MessageSquareHeart className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="text-sm font-medium text-cyan-100/78">
                  Product feedback
                </p>
                <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Send the signal that improves Rearvy.
                </h1>
                <p className="max-w-md text-sm leading-6 text-white/66 sm:text-base">
                  Report broken workflows, request missing capabilities, and attach page context so the right fix gets prioritized.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-3">
              {[
                ["Direct route", "Goes to the product owner"],
                ["Page context", sourcePath],
                ["Actionable notes", "Bugs and feature ideas"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-[8px] border border-white/12 bg-white/8 p-3 backdrop-blur"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="truncate text-xs text-white/58">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <div className="bg-slate-950 p-5 sm:p-8">
            <Card className="relative h-full overflow-hidden rounded-[8px] border-slate-800 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] text-slate-100 shadow-none">
              <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-cyan-300 via-sky-400 to-violet-400" />
              <CardHeader className="pb-5 pt-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle className="text-2xl font-semibold tracking-tight text-white">
                      What should we fix or build?
                    </CardTitle>
                    <CardDescription className="mt-2 text-slate-400">
                      Type the problem or feature you want in plain language.
                    </CardDescription>
                  </div>
                  <div className="inline-flex shrink-0 items-center gap-2 rounded-[8px] border border-cyan-400/20 bg-slate-950/90 px-3 py-2 text-xs font-semibold text-slate-100 shadow-sm shadow-cyan-950/30">
                    <MessageSquareHeart className="h-3.5 w-3.5 text-cyan-300" aria-hidden />
                    Product inbox
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-3 md:grid-cols-3">
                  {feedbackPrompts.map((prompt) => {
                    const Icon = prompt.icon;

                    return (
                      <div key={prompt.title} className="min-w-0 border-l border-cyan-400/25 bg-slate-900/70 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5 shrink-0 text-cyan-300" aria-hidden />
                          <p className="truncate text-xs font-semibold text-slate-100">
                            {prompt.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">
                          {prompt.detail}
                        </p>
                      </div>
                    );
                  })}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="feedback-message" className="text-sm font-semibold text-slate-100">
                      Problem or feature
                    </label>
                    {sourcePage !== "/feedback" && (
                      <span className="inline-flex max-w-[220px] items-center truncate rounded-[6px] border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-medium text-slate-300">
                        Page: {sourcePath}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="feedback-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the problem or feature you want. Include what you expected, what happened, or how this would help."
                    maxLength={1000}
                    className="min-h-[260px] resize-y rounded-[8px] border-slate-700 bg-slate-950/90 p-4 text-sm text-slate-100 shadow-inner shadow-black/20 transition-colors placeholder:text-slate-400/85 focus:border-cyan-400/70 focus:bg-slate-950"
                  />
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-400">
                        <span>
                          <span className={cn(message.length > 950 && "text-rose-500")}>
                            {message.length}
                          </span>
                          <span className="opacity-60"> / 1000 characters</span>
                        </span>
                        <span className="text-slate-500">
                          {message.trim().length > 0 ? "Ready to send" : "Waiting for details"}
                        </span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-[8px] bg-slate-800">
                        <div
                          className={cn(
                            "h-full rounded-[8px] bg-cyan-400 transition-all",
                            message.length > 950 && "bg-rose-500"
                          )}
                          style={{ width: `${messageProgress}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs leading-5 text-slate-400">
                        Short, specific notes are easiest to route.
                      </p>
                      <Button
                        type="button"
                        size="lg"
                        className="h-11 gap-2 rounded-[8px] border border-cyan-300/20 bg-white px-6 font-semibold text-slate-950 shadow-sm shadow-black/20 transition-all hover:bg-slate-200 active:scale-[0.99] disabled:border-slate-700 disabled:bg-slate-900 disabled:text-slate-500"
                        onClick={handleSubmit}
                        disabled={isSubmitting || message.trim().length === 0}
                      >
                        {isSubmitting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                        Submit feedback
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <p className="mt-4 flex items-center justify-center gap-2 text-center text-sm text-muted-foreground/70">
        <Sparkles className="h-3 w-3" />
        Every note helps us make the workspace sharper.
      </p>
    </section>
  );
}
