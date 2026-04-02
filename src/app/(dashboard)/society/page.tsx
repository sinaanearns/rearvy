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
import { Loader2, Plus, Users } from "lucide-react";
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
  const loginHref = "/login?redirect=%2Fsociety%2Fdashboard";
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

  return (
    <div className="space-y-8">
      {user && (
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-muted/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">
              Signed in as
            </p>
            <p className="text-base font-semibold">
              {user.displayName || user.email || "Rearvy member"}
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => router.push("/society/new")} size="lg">
              <Plus className="mr-2 h-4 w-4" />
              Submit New Idea
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
      )}

      {!user && !loading && (
        <Card className="border-blue-200 bg-blue-50">
          <CardHeader>
            <CardTitle>Start with Rearvy Society</CardTitle>
            <CardDescription>
              Sign in or create an account to join projects and launch your own
              idea.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row">
            <Link href={loginHref}>
              <Button>
                Sign in
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link href={signupHref}>
              <Button variant="outline">Create account</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-red-800">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && societies.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {societies.map((society) => (
            <Link key={society.id} href={`/society/${society.id}`}>
              <Card className="h-full cursor-pointer transition-shadow hover:shadow-lg">
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
      )}
    </div>
  );
}
