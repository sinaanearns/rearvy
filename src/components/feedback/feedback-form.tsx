"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, Sparkles } from "lucide-react";
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
}> = [
  {
    value: "issue",
    label: "Issue",
    icon: AlertCircle,
    description: "Something is broken or behaving incorrectly.",
  },
  {
    value: "feature",
    label: "Feature",
    icon: Sparkles,
    description: "You want a new capability or workflow.",
  },
];

export function FeedbackForm() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("issue");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sourcePage = searchParams.get("from") || "/feedback";

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
          ? "Issue report sent."
          : "Feature request sent."
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
    <div className="mx-auto max-w-3xl space-y-6 px-4 md:px-0">
      <div>
        <h1 className="text-2xl font-bold md:text-3xl">Feedback</h1>
        <p className="mt-2 text-sm text-muted-foreground md:text-base">
          Report product issues or request features you want to see next.
        </p>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle>Send product feedback</CardTitle>
          <CardDescription>
            We store your note together with the page you came from so it is easier to reproduce issues.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 md:grid-cols-2">
            {feedbackOptions.map(({ value, label, icon: Icon, description }) => (
              <button
                key={value}
                type="button"
                onClick={() => setFeedbackType(value)}
                className={cn(
                  "rounded-2xl border p-4 text-left transition-colors",
                  feedbackType === value
                    ? "border-primary bg-primary/5"
                    : "border-border bg-card hover:bg-accent/40"
                )}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-xl",
                      feedbackType === value
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium">{label}</p>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-medium">Details</p>
              <p className="text-xs text-muted-foreground">Source: {sourcePage}</p>
            </div>
            <Textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={
                feedbackType === "issue"
                  ? "Describe what broke, what you expected, and how to reproduce it."
                  : "Describe the feature, who it helps, and the problem it solves."
              }
              maxLength={1000}
              className="min-h-48 resize-y"
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">{message.trim().length}/1000</p>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={isSubmitting || message.trim().length === 0}
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit feedback
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}