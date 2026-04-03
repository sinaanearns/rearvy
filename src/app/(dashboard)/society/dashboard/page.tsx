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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

interface NetworkConnection {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  accepted_at: string | null;
}

type DashboardView = "feed" | "businesses";

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
  const [view, setView] = useState<DashboardView>("feed");
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [network, setNetwork] = useState<NetworkConnection[]>([]);
  const [networkLoading, setNetworkLoading] = useState(false);
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

  useEffect(() => {
    if (authLoading || !user) {
      return;
    }

    async function loadNetwork() {
      try {
        setNetworkLoading(true);

        const token = await getIdToken();
        if (!token) {
          return;
        }

        const response = await fetch("/api/dashboard/network", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Unable to load network");
        }

        const data = (await response.json()) as { network?: NetworkConnection[] };
        setNetwork(data.network || []);
      } catch (loadError) {
        console.error("Error loading network:", loadError);
        setNetwork([]);
      } finally {
        setNetworkLoading(false);
      }
    }

    void loadNetwork();
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
  const feedPosts = [
    {
      label: "Project feed",
      title: "Rearvy is turning public posts into clear action",
      description:
        "Anyone can post updates, ideas, and progress. Admins separately review and publish businesses.",
      meta: `${societies.length} published businesses`,
      accent:
        "bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.38),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(30,41,59,0.9))]",
    },
    {
      label: "Community",
      title: "Contributors can help shape the next release",
      description:
        "Use the idea form, open chat, or share feedback to keep the build moving with the right people.",
      meta: `${network.length} in your network`,
      accent:
        "bg-[radial-gradient(circle_at_top_right,rgba(16,185,129,0.32),transparent_40%),linear-gradient(135deg,rgba(17,24,39,0.96),rgba(3,7,18,0.9))]",
    },
    {
      label: "Next sprint",
      title: "More integrations, stronger insights, faster execution",
      description:
        "The next phase is about expanding connected data sources and making the recommendations more useful.",
      meta: `${profile?.project_links?.length || 0} links on profile`,
      accent:
        "bg-[radial-gradient(circle_at_bottom_left,rgba(244,114,182,0.28),transparent_42%),linear-gradient(135deg,rgba(24,24,27,0.96),rgba(39,39,42,0.9))]",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.14),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.1),transparent_38%)]" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        <section className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-sm backdrop-blur sm:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Rearvy Society
              </div>

              <div className="flex items-start gap-4 sm:gap-5">
                <div className="relative shrink-0">
                  <Avatar className="h-20 w-20 border-4 border-card shadow-lg shadow-black/15 sm:h-24 sm:w-24">
                    <AvatarImage src={profile?.avatar_url || undefined} alt={displayName} />
                    <AvatarFallback className="text-2xl font-semibold">
                      {getInitials(displayName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full border-2 border-card bg-emerald-400" />
                </div>

                <div className="min-w-0 flex-1 space-y-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                        {displayName}
                      </h1>
                      <span className="rounded-full border border-border/60 bg-muted/70 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                        Founder
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground sm:text-base">{profileUsername}</p>
                  </div>

                  <p className="max-w-2xl text-sm leading-6 text-muted-foreground sm:text-base">
                    {profile?.bio || "Founder and operator building in public with Rearvy."}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                      {profileBusiness}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground capitalize">
                      {profile?.business_type || "Founder"}
                    </span>
                    <span className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs font-medium text-foreground">
                      {accountEmail}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                  <p className="text-2xl font-semibold leading-none">{feedPosts.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Feed posts</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                  <p className="text-2xl font-semibold leading-none">{societies.length}</p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Published businesses</p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3">
                  <p className="text-2xl font-semibold leading-none">
                    {networkLoading ? "..." : `${network.length}`}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-widest text-muted-foreground">Network</p>
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
                <p className="text-xs uppercase tracking-widest text-muted-foreground">Your network</p>
                {networkLoading ? (
                  <p className="mt-3 text-sm text-muted-foreground">Loading network...</p>
                ) : network.length === 0 ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    People who accept your follow request will appear here.
                  </p>
                ) : (
                  <div className="mt-3 grid gap-2">
                    {network.map((connection) => {
                      const connectionName =
                        connection.full_name ||
                        connection.username ||
                        "Rearvy member";

                      return (
                        <Link
                          key={connection.id}
                          href={`/users/${connection.id}`}
                          className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/80 px-3 py-2 transition hover:border-primary/40 hover:bg-card"
                        >
                          <Avatar className="h-9 w-9 border border-border/60">
                            <AvatarImage src={connection.avatar_url || undefined} alt={connectionName} />
                            <AvatarFallback>{getInitials(connectionName)}</AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{connectionName}</p>
                            <p className="truncate text-xs text-muted-foreground">
                              {connection.username ? `@${connection.username.replace(/^@/, "")}` : "Member"}
                            </p>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                <Button onClick={() => router.push("/society/new")} size="lg" className="justify-between">
                  Create Post
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
                >
                  {logoutLoading ? "Logging out..." : "Logout"}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-border/70 bg-background/75 p-5 shadow-sm">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  Public profile
                </div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Instagram-style profile view for the society space. Switch between the project feed and the businesses admins have published.
                </p>
                <div className="rounded-3xl border border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_40%),linear-gradient(135deg,rgba(15,23,42,0.96),rgba(3,7,18,0.92))] p-5 text-white shadow-inner">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/60">Profile focus</p>
                  <h2 className="mt-3 text-2xl font-semibold tracking-tight">Build in public, publish when ready.</h2>
                  <p className="mt-3 max-w-md text-sm leading-6 text-white/75">
                    Keep the top section personal and the lower section content-driven. That gives the dashboard the same shape people expect from a social profile.
                  </p>
                </div>
              </div>
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
              <Button onClick={() => router.push("/society/new")}>Create Post</Button>
            </CardContent>
          </Card>
        )}

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/70 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {!loading && (
          <section className="space-y-4">
            <Tabs value={view} onValueChange={(value) => setView(value as DashboardView)} className="space-y-5">
              <TabsList className="w-full justify-start gap-2 bg-muted/60 p-1 sm:w-auto">
                <TabsTrigger value="feed" className="rounded-full px-4 text-sm">
                  Project feed
                </TabsTrigger>
                <TabsTrigger value="businesses" className="rounded-full px-4 text-sm">
                  Published businesses
                </TabsTrigger>
              </TabsList>

              <TabsContent value="feed" className="space-y-4 outline-none">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  {feedPosts.map((post) => (
                    <Card key={post.title} className="overflow-hidden border-border/70 bg-card/95 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
                      <div className={`h-44 ${post.accent}`} />
                      <CardHeader className="space-y-2">
                        <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                          <span>{post.label}</span>
                          <span>{post.meta}</span>
                        </div>
                        <CardTitle className="text-xl leading-tight">{post.title}</CardTitle>
                        <CardDescription className="text-sm leading-6">{post.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="pb-5">
                        <Link href="/society/messages" className="inline-flex items-center gap-2 text-sm font-medium text-foreground transition hover:text-primary">
                          Open discussion
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="businesses" className="space-y-4 outline-none">
                {societies.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {societies.map((society) => (
                      <Link key={society.id} href={`/society/${society.id}`}>
                        <Card className="group h-full overflow-hidden border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-lg">
                          <div className="h-36 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.26),transparent_42%),linear-gradient(135deg,rgba(15,23,42,0.95),rgba(30,41,59,0.88))]" />
                          <CardHeader className="space-y-2">
                            <div className="flex items-center justify-between gap-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                              <span className="capitalize">{society.category}</span>
                              <span>{society.status}</span>
                            </div>
                            <CardTitle className="line-clamp-2 text-xl">{society.name}</CardTitle>
                            <CardDescription className="line-clamp-2 text-sm leading-6">
                              {society.description || "A published Rearvy business ready for members and contributors."}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-4 pb-5">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <Users className="h-4 w-4" />
                              {society.member_count} members
                            </div>
                            <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm">
                              <span>Open profile</span>
                              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Card className="border-border/70 bg-card/90">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Compass className="h-5 w-5 text-primary" />
                        No published businesses yet
                      </CardTitle>
                      <CardDescription>
                            Ask an admin to publish a business, or create a public post to join the conversation.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-wrap gap-2">
                          <Button onClick={() => router.push("/society/new")}>Create Post</Button>
                      <Button onClick={() => router.push("/society/messages")} variant="outline">
                        Open Chat
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </section>
        )}
      </div>
    </div>
  );
}

