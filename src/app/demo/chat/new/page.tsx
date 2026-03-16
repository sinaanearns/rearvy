"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowRight, MessageSquare, Plug, Sparkles } from "lucide-react";

const DEMO_STORAGE_KEY = "rearvy_demo_integrated";

export default function DemoNewChatPage() {
  const [demoIntegrated, setDemoIntegrated] = useState(false);

  useEffect(() => {
    const val = window.localStorage.getItem(DEMO_STORAGE_KEY);
    setDemoIntegrated(val === "1");
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Demo chat</h1>
        <p className="mt-1 text-muted-foreground">
          Start with an empty workspace, then add demo integrations to try Rearvy instantly.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <MessageSquare className="h-4 w-4" />
            New chat session
          </CardTitle>
          <CardDescription>
            {demoIntegrated
              ? "Demo data is connected. Ask questions using sample YouTube and Website metrics."
              : "No integrations connected yet. Connect demo data to unlock sample answers."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">Assistant</p>
            {!demoIntegrated ? (
              <p className="mt-1 text-sm">
                You are in a fresh demo chat. I do not have connected data yet.
                Go to Integrations and click <strong>Integrate demo data</strong> to load sample metrics.
              </p>
            ) : (
              <p className="mt-1 text-sm">
                Demo data connected. I can answer questions like: "How is the YouTube channel performing?"
                and "What are website views this week?"
              </p>
            )}
          </div>

          {demoIntegrated ? (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">YouTube: 2,000,000 subscribers</Badge>
              <Badge variant="secondary">Website: 1,000 views</Badge>
            </div>
          ) : (
            <div className="rounded-lg border border-amber-300/40 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
              Demo integrations are not connected yet.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Link href="/demo/integrations">
              <Button>
                <Plug className="h-4 w-4" />
                Go to integrations
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="outline">
                Use real account
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Sparkles className="h-4 w-4" />
            Demo prompts
          </CardTitle>
          <CardDescription>
            Try these after demo data is integrated
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          <div className="rounded-lg border p-3 text-sm">@YouTube summarize channel growth this month</div>
          <div className="rounded-lg border p-3 text-sm">@YouTube compare views vs subscribers</div>
          <div className="rounded-lg border p-3 text-sm">@Website how many views did we get this week?</div>
          <div className="rounded-lg border p-3 text-sm">@Website what pages are performing best?</div>
        </CardContent>
      </Card>
    </div>
  );
}
