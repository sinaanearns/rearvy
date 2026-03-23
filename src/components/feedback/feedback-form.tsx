"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Sparkles, Send, MessageSquareHeart } from "lucide-react";
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

type FeedbackType = "issue" | "feature";

const feedbackOptions: Array<{
  value: FeedbackType;
  label: string;
  icon: typeof AlertCircle;
  description: string;
  activeBorder: string;
  iconColor: string;
  iconBg: string;
  activeBg: string;
}> = [
  {
    value: "issue",
    label: "Report Issue",
    icon: AlertCircle,
    description: "Something is broken or behaving incorrectly.",
    activeBorder: "border-rose-500/50 dark:border-rose-500/50",
    iconColor: "text-rose-600 dark:text-rose-400",
    iconBg: "bg-rose-100 dark:bg-rose-500/10",
    activeBg: "bg-rose-500/5 dark:bg-rose-500/5",
  },
  {
    value: "feature",
    label: "Feature Request",
    icon: Sparkles,
    description: "You want a new capability or workflow.",
    activeBorder: "border-indigo-500/50 dark:border-indigo-500/50",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-100 dark:bg-indigo-500/10",
    activeBg: "bg-indigo-500/5 dark:bg-indigo-500/5",
  },
];

export function FeedbackForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("issue");
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
          type: feedbackType,
          message: trimmedMessage,
          page: sourcePage,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send feedback.");
      }

      setMessage("");
      toast.success(
        feedbackType === "issue"
          ? "Issue report sent successfully!"
          : "Feature request sent successfully!"
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to send feedback.";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl py-8 px-4 md:px-0">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <MessageSquareHeart className="h-6 w-6" />
        </div>
        <h1 className="bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
          Help us improve
        </h1>
        <p className="mt-3 text-base text-muted-foreground sm:text-lg max-w-[500px]">
          Have an idea or spotted a bug? Let us know so we can make the product better for you.
        </p>
      </div>

      <Card className="border-border/50 bg-card/40 backdrop-blur-xl shadow-xl shadow-black/5 dark:shadow-black/20 overflow-hidden">
        <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-500 opacity-80" />
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">What kind of feedback do you have?</CardTitle>
          <CardDescription>
            Select a feedback type to help us route this to the right team.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {feedbackOptions.map(
              ({
                value,
                label,
                icon: Icon,
                description,
                activeBorder,
                iconColor,
                iconBg,
                activeBg,
              }) => {
                const isActive = feedbackType === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFeedbackType(value)}
                    className={cn(
                      "group relative flex flex-col gap-3 rounded-2xl border-2 p-5 text-left transition-all duration-200 ease-out",
                      isActive
                        ? cn(activeBorder, activeBg)
                        : "border-transparent bg-muted/50 hover:bg-muted"
                    )}
                  >
                    <div
                      className={cn(
                        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110",
                        isActive ? iconBg : "bg-background shadow-xs",
                        iconColor
                      )}
                    >
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className={cn("font-semibold leading-none mb-2 text-foreground", isActive && iconColor)}>
                        {label}
                      </p>
                      <p className="text-sm leading-snug text-muted-foreground">
                        {description}
                      </p>
                    </div>
                  </button>
                );
              }
            )}
          </div>

          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between gap-3 px-1">
              <label htmlFor="feedback-message" className="text-sm font-medium text-foreground">
                Additional Details
              </label>
              {sourcePage !== "/feedback" && (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground ring-1 ring-inset ring-border/50">
                  Page: {sourcePage.split('?')[0]}
                </span>
              )}
            </div>
            <Textarea
              id="feedback-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                feedbackType === "issue"
                  ? "What were you trying to do? What happened instead?"
                  : "How would you use this feature? What problem does it solve for you?"
              }
              maxLength={1000}
              className="min-h-[160px] resize-y rounded-xl border-border/50 bg-background/50 focus:bg-background transition-colors p-4 shadow-sm"
            />
            <div className="flex items-center justify-between gap-3 px-1 pt-1">
              <p className="text-xs font-medium text-muted-foreground">
                <span className={cn(message.length > 950 && "text-rose-500")}>
                  {message.length}
                </span>
                <span className="opacity-60"> / 1000 characters</span>
              </p>
              <Button
                type="button"
                size="lg"
                className="gap-2 rounded-xl h-11 px-6 shadow-md transition-all hover:shadow-lg active:scale-95"
                onClick={handleSubmit}
                disabled={isSubmitting || message.trim().length === 0}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Submit Feedback
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <p className="mt-6 text-center text-sm text-muted-foreground/60 flex items-center justify-center gap-2">
        <Sparkles className="h-3 w-3" />
        Thank you for helping us shape Rearvy!
      </p>
    </div>
  );
}