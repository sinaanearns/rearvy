"use client";

import { useEffect, useState } from "react";
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
import { getIdToken } from "@/lib/firebase/auth";
import { useAuthContext } from "@/hooks/use-auth-context";
import {
  ArrowRight,
  Compass,
  Lightbulb,
  Loader2,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { signOut } from "@/lib/firebase/auth";

interface Society {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  member_count: number;
  founder_id: string;
}

export default function SocietiesPage() {
  const [societies, setSocieties] = useState<Society[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const loginHref = "/society/login?redirect=%2Fsociety%2Fdashboard";
  const signupHref = "/signup?redirect=%2Fsociety%2Fdashboard";

  useEffect(() => {
    if (authLoading) return;

    if (user) {
      router.replace("/society/dashboard");
      return;
    }

    if (!user) {
      setLoading(false);
      setSocieties([]);
      return;
    }
  }, [authLoading, user, router]);

  async function fetchSocieties() {
    try {
      setLoading(true);
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
        throw new Error("Failed to load societies");
      }

      const data = await response.json();
      setSocieties(data.societies || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLogoutLoading(true);

    try {
      const { error: signOutError } = await signOut();
      if (signOutError) {
        setError(signOutError);
        return;
      }

      setSocieties([]);
      router.refresh();
    } finally {
      setLogoutLoading(false);
    }
  }

  const highlights = [
    {
      icon: Lightbulb,
      title: "Shape new products",
      description:
        "Pitch ideas, refine them with real feedback, and turn concepts into validated project plans.",
    },
    {
      icon: Users,
      title: "Build with collaborators",
      description:
        "Find people with matching skills and form focused teams around promising initiatives.",
    },
    {
      icon: Compass,
      title: "Move from idea to execution",
      description:
        "Track momentum, align goals, and keep every society initiative progressing clearly.",
    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_44%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_38%)]" />
      <div className="relative mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pb-12 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        <section className="rounded-3xl border border-border/60 bg-card/85 p-6 shadow-sm backdrop-blur sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.35fr_1fr] lg:items-center">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-muted/70 px-3 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Rearvy Society
              </div>
              <h1 className="max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                Start bold ideas and build them with the right people.
              </h1>
              <p className="max-w-2xl text-sm text-muted-foreground sm:text-base">
                Rearvy Society helps creators and operators collaborate from first spark to real execution.
                Join projects, launch your own idea, and keep progress visible.
              </p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:gap-3">
                <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">Idea-first workflows</span>
                <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">Team matching</span>
                <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">Execution tracking</span>
              </div>
            </div>

            {!user && !loading && (
              <Card className="border-primary/20 bg-card/95 shadow-md">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl">Start with Rearvy Society</CardTitle>
                  <CardDescription className="text-sm">
                    Sign in or create an account to join projects and launch your own idea.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button asChild size="lg" className="w-full justify-between">
                    <Link href={loginHref}>
                      Sign in
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="w-full">
                    <Link href={signupHref}>Create account</Link>
                  </Button>
                </CardContent>
              </Card>
            )}

            {user && (
              <Card className="border-primary/20 bg-card/95 shadow-md">
                <CardHeader className="space-y-2">
                  <CardTitle className="text-xl">Welcome back</CardTitle>
                  <CardDescription>
                    {user.displayName || user.email || "Rearvy member"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Button onClick={() => router.push("/society/new")} size="lg" className="justify-between">
                    Submit New Idea
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    onClick={handleLogout}
                    size="lg"
                    variant="outline"
                    disabled={logoutLoading}
                  >
                    {logoutLoading ? "Logging out..." : "Logout"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {highlights.map((item) => (
            <Card key={item.title} className="border-border/60 bg-card/90">
              <CardHeader className="space-y-3">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <item.icon className="h-5 w-5" />
                </div>
                <CardTitle className="text-lg">{item.title}</CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {item.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </section>

        {loading && (
          <div className="flex items-center justify-center rounded-2xl border border-border/60 bg-card/70 py-10">
            <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
          </div>
        )}

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader>
              <CardTitle className="text-red-900">Error</CardTitle>
            </CardHeader>
            <CardContent className="text-red-800">{error}</CardContent>
          </Card>
        )}

        {!loading && societies.length > 0 && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Active Societies</h2>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {societies.map((society) => (
                <Link key={society.id} href={`/society/${society.id}`}>
                  <Card className="h-full cursor-pointer border-border/70 bg-card/95 transition hover:-translate-y-0.5 hover:shadow-lg">
                    <CardHeader>
                      <CardTitle className="line-clamp-2">{society.name}</CardTitle>
                      <CardDescription className="capitalize">
                        {society.category}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {society.description && (
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {society.description}
                        </p>
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
      </div>
    </div>
  );
}
