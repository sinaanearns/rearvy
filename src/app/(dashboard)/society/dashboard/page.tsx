"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getIdToken, signOut } from "@/lib/firebase/auth";
import { useAuthContext } from "@/hooks/use-auth-context";
import {
  AlertCircle,
  Compass,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";

interface Society {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  member_count: number;
  founder_id: string;
}

export default function SocietyDashboardPage() {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const accountEmail = user?.email || "Not available";
  const accountUsername =
    user?.displayName ||
    (user?.email ? user.email.split("@")[0] : "Rearvy member");

  const fetchSocieties = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token. Please sign in again.");
      }

      const response = await fetch("/api/societies", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const apiError = payload?.error as string | undefined;

        if (response.status === 401) {
          router.replace("/society/login?redirect=%2Fsociety%2Fdashboard");
          return;
        }

        if (response.status === 403) {
          throw new Error(apiError || "You do not have access to these societies yet.");
        }

        throw new Error(apiError || "Unable to load societies right now.");
      }

      const data = await response.json();
      setSocieties(data.societies || []);
    } catch (err: unknown) {
      setSocieties([]);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load societies right now."
      );
    } finally {
      setLoading(false);
      setRetrying(false);
    }
  }, [router]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.replace("/society/login?redirect=%2Fsociety%2Fdashboard");
      return;
    }

    void fetchSocieties();
  }, [authLoading, user, router, fetchSocieties]);

  async function handleRetry() {
    setRetrying(true);
    await fetchSocieties();
  }

  async function handleLogout() {
    setLogoutLoading(true);

    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(signOutError);
        return;
      }

      router.replace("/society");
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_38%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Rearvy Society
              </div>
              <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Society Dashboard
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Manage societies, collaborate with builders, and keep every idea moving forward.
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                <p>
                  Username: <span className="font-medium text-foreground">{accountUsername}</span>
                </p>
                <p>
                  Gmail: <span className="font-medium text-foreground">{accountEmail}</span>
                </p>
              </div>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <Button onClick={() => router.push("/society/new")} size="lg" className="justify-between">
                Submit New Idea
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                onClick={() => router.push("/society/messages")}
                size="lg"
                variant="outline"
                className="justify-between"
              >
                Open Chat
                <MessageSquare className="h-4 w-4" />
              </Button>
              <Button
                onClick={handleLogout}
                size="lg"
                variant="outline"
                disabled={logoutLoading}
                className="sm:col-span-2 lg:col-span-1"
              >
                {logoutLoading ? "Logging out..." : "Logout"}
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <Card className="border-amber-200 bg-amber-50/90">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertCircle className="h-4 w-4" />
                Could not load societies
              </CardTitle>
              <CardDescription className="text-amber-800">
                {error}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={handleRetry} variant="outline" disabled={retrying || loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                Retry
              </Button>
              <Button onClick={() => router.push("/society/new")}>Submit New Idea</Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/70 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && societies.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Published Businesses</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {societies.map((society) => (
                <Link key={society.id} href={`/society/${society.id}`}>
                  <Card className="h-full cursor-pointer border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{society.name}</CardTitle>
                      <CardDescription className="capitalize">{society.category}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {society.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">{society.description}</p>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Users className="mr-2 h-4 w-4" />
                        {society.member_count} members
                      </div>
                      <div className="flex gap-2">
                        <span className="inline-block rounded-full bg-secondary px-2 py-1 text-xs">
                          {society.status}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        )}

        {!loading && societies.length === 0 && !error && (
          <Card className="border-border/70 bg-card/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Compass className="h-5 w-5 text-primary" />
                No published businesses yet
              </CardTitle>
              <CardDescription>
                Ask an admin to publish a business, or submit a new idea to start one.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button onClick={() => router.push("/society/new")}>Start a Society</Button>
              <Button onClick={() => router.push("/society/messages")} variant="outline">
                Open Chat
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
