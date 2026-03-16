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
import { CheckCircle2, Globe, Link2, Youtube } from "lucide-react";

const DEMO_STORAGE_KEY = "rearvy_demo_integrated";

export default function DemoIntegrationsPage() {
  const [demoIntegrated, setDemoIntegrated] = useState(false);

  useEffect(() => {
    const val = window.localStorage.getItem(DEMO_STORAGE_KEY);
    setDemoIntegrated(val === "1");
  }, []);

  const handleIntegrateDemoData = () => {
    window.localStorage.setItem(DEMO_STORAGE_KEY, "1");
    setDemoIntegrated(true);
  };

  const handleResetDemoData = () => {
    window.localStorage.removeItem(DEMO_STORAGE_KEY);
    setDemoIntegrated(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">Demo integrations</h1>
        <p className="mt-1 text-muted-foreground">
          One click to connect sample data. No OAuth, no Google login, no real accounts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">Integration status</CardTitle>
          <CardDescription>
            {demoIntegrated
              ? "Demo data connected successfully."
              : "No integrations connected yet."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {demoIntegrated ? (
            <div className="flex items-center gap-2 rounded-lg border border-green-300/40 bg-green-50 px-3 py-2 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="h-4 w-4" />
              Demo integrations are active.
            </div>
          ) : (
            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
              Click the button below to load example integration data.
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button onClick={handleIntegrateDemoData}>
              <Link2 className="h-4 w-4" />
              Integrate demo data
            </Button>
            <Button variant="outline" onClick={handleResetDemoData}>
              Reset demo data
            </Button>
            <Link href="/demo/chat/new">
              <Button variant="secondary">Go back to demo chat</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Youtube className="h-5 w-5 text-red-500" />
              YouTube (demo)
            </CardTitle>
            <CardDescription>Sample channel metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Subscribers</span>
              <Badge variant="secondary">2,000,000</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Total views (30d)</span>
              <Badge variant="secondary">6,420,000</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Videos</span>
              <Badge variant="secondary">145</Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Globe className="h-5 w-5 text-blue-500" />
              Website (demo)
            </CardTitle>
            <CardDescription>Sample web analytics metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Views</span>
              <Badge variant="secondary">1,000</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Unique visitors</span>
              <Badge variant="secondary">420</Badge>
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <span>Avg session duration</span>
              <Badge variant="secondary">3m 12s</Badge>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
