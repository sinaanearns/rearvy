"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  CheckCircle2,
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

export function FeedbackForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourcePage = searchParams?.get("from") || "/feedback";

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

      const data = await response.json();

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
      <div className="overflow-hidden rounded-[8px] border border-slate-200 bg-white shadow-2xl shadow-slate-950/8 dark:border-slate-800 dark:bg-slate-950">
        <div className="grid min-h-[620px] lg:grid-cols-[0.92fr_1.08fr]">
          <aside className="relative flex flex-col justify-between overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),transparent_34%),linear-gradient(315deg,rgba(244,63,94,0.18),transparent_28%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:56px_56px]" />

            <div className="relative space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-white/14 bg-white/10 text-cyan-100 shadow-xl shadow-black/30">
                <MessageSquareHeart className="h-6 w-6" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-200">
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
                ["Page context", sourcePage.split("?")[0]],
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

          <div className="p-5 sm:p-8">
            <Card className="h-full rounded-[8px] border-slate-200 bg-slate-50/60 shadow-none dark:border-slate-800 dark:bg-slate-900/50">
              <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  What should we fix or build?
                </CardTitle>
                <CardDescription>
                  Type the problem or feature you want in plain language.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <label htmlFor="feedback-message" className="text-sm font-semibold text-foreground">
                      Problem or feature
                    </label>
                    {sourcePage !== "/feedback" && (
                      <span className="inline-flex max-w-[220px] items-center truncate rounded-[6px] border border-slate-200 bg-white px-2 py-1 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                        Page: {sourcePage.split("?")[0]}
                      </span>
                    )}
                  </div>
                  <Textarea
                    id="feedback-message"
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    placeholder="Describe the problem or feature you want. Include what you expected, what happened, or how this would help."
                    maxLength={1000}
                    className="min-h-[260px] resize-y rounded-[8px] border-slate-200 bg-white p-4 text-sm shadow-inner shadow-slate-950/[0.02] transition-colors placeholder:text-slate-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950"
                  />
                  <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs font-medium text-muted-foreground">
                      <span className={cn(message.length > 950 && "text-rose-500")}>
                        {message.length}
                      </span>
                      <span className="opacity-60"> / 1000 characters</span>
                    </p>
                    <Button
                      type="button"
                      size="lg"
                      className="h-11 gap-2 rounded-[8px] bg-slate-950 px-6 font-semibold text-white shadow-lg shadow-slate-950/15 transition-all hover:bg-slate-800 active:scale-[0.99] dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
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
