"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  ArrowRight,
  Compass,
  Loader2,
  MessageSquare,
  Plus,
  RefreshCw,
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

interface ProfileSummary {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  working_on?: string | null;
  skills?: string[] | null;
  project_links?: string[] | null;
  business_name?: string | null;
  business_type?: string | null;
  plan?: string | null;
  timezone?: string | null;
  currency?: string | null;
  email?: string | null;
}

function getInitials(name: string) {
  const words = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (words.length === 0) {
    return "R";
  }

  return words.map((word) => word[0]?.toUpperCase() || "").join("");
}

export default function SocietyDashboardPage() {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
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

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    async function loadProfile() {
      try {
        setProfileLoading(true);

        const token = await getIdToken();
        if (!token) {
          return;
        }

        const response = await fetch("/api/dashboard/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load profile");
        }

        const data = (await response.json()) as { profile?: ProfileSummary };
        setProfile(data.profile || null);
      } catch (loadError) {
        console.error("Error loading profile:", loadError);
        setProfile(null);
      } finally {
        setProfileLoading(false);
      }
    }

    void loadProfile();
  }, [authLoading, user]);

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

  const displayName = profile?.full_name || user?.displayName || user?.email || "Rearvy member";
  const profileUsername = profile?.username || "@rearvy";
  const profileBusiness = profile?.business_name || "Not set";

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

        {user && (
          <section>
            <Link href="/profile" className="block group max-w-sm">
              <Card className="overflow-hidden border-border/60 bg-card/90 shadow-sm transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-slate-500/40 group-hover:shadow-lg">
                <div className="h-18 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.34),transparent_45%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.9))]" />
                <CardContent className="-mt-8 space-y-4 px-5 pb-5">
                  <div className="flex items-end justify-between gap-3">
                    <div className="relative">
                      <Avatar className="h-16 w-16 rounded-2xl border-4 border-card shadow-lg shadow-black/20">
                        <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                        <AvatarFallback className="rounded-2xl text-lg font-semibold">
                          {getInitials(displayName)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-400" />
                    </div>

                    <div className="rounded-full border border-border/60 bg-muted/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                      Founder
                    </div>
                  </div>

                  <div className="space-y-1">
                    <CardTitle className="text-xl leading-tight">{displayName}</CardTitle>
                    <CardDescription className="truncate">{profileUsername}</CardDescription>
                  </div>

                  <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                    {profile?.bio || "Founder and operator building in public with Rearvy."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground">
                      {profile?.business_name || "Rearvy"}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-foreground capitalize">
                      {profile?.business_type || "Founder"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/60 px-4 py-3 text-sm">
                    <span className="text-muted-foreground">
                      {profileLoading ? "Loading profile..." : "Open profile"}
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </section>
        )}

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

