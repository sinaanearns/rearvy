"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  FolderKanban,
  Loader2,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getErrorMessage } from "@/lib/error-utils";

interface JoinProjectPageProps {
  params: Promise<{ inviteCode: string }>;
}

export default function JoinProjectPage({ params }: JoinProjectPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteCode, setInviteCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ inviteCode }) => setInviteCode(inviteCode));
  }, [params]);

  useEffect(() => {
    if (!authLoading && inviteCode && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/join-project/${inviteCode}`)}`);
    }
  }, [authLoading, inviteCode, router, user]);

  const handleJoin = async () => {
    if (!user || !inviteCode) return;

    setJoining(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/projects/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = (await response.json()) as { error?: string; projectId?: string };

      if (!response.ok) {
        throw new Error(data.error || "Failed to join project");
      }

      if (!data.projectId) {
        throw new Error("Join response did not include a project id");
      }

      router.push(`/projects/${data.projectId}`);
    } catch (err) {
      setError(getErrorMessage(err, "Something went wrong"));
    } finally {
      setJoining(false);
    }
  };

  if (authLoading || !inviteCode || !user) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-card/80 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing workspace invite...
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center px-4 py-6 sm:px-6">
      <div className="grid w-full overflow-hidden rounded-[8px] border border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-slate-950 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative min-h-[420px] overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.22),transparent_34%),linear-gradient(315deg,rgba(14,165,233,0.2),transparent_34%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:60px_60px]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-emerald-200/20 bg-emerald-200/10 text-emerald-100 shadow-sm shadow-black/25">
                <FolderKanban className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-emerald-200">
                  Client workspace
                </p>
                <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Join the workspace where the client work lives.
                </h1>
                <p className="max-w-md text-sm leading-6 text-white/66 sm:text-base">
                  Accept the invite to access the project, related chats, resources, and the working context behind the next deliverable.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                ["Workspace access", "Project chats and resources unlock together"],
                ["Client continuity", "Briefs, decisions, and follow-ups stay grouped"],
                ["Invite protected", "The project code is verified before entry"],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="flex items-center gap-3 rounded-[8px] border border-white/12 bg-white/8 p-3 backdrop-blur"
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{label}</p>
                    <p className="truncate text-xs text-white/58">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </aside>

        <div className="p-5 sm:p-8">
          <Card className="h-full justify-center rounded-[8px] border-border/70 bg-background/80 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
            <CardHeader className="space-y-4 text-center">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] border border-emerald-200/30 bg-emerald-200/10 text-emerald-600 dark:text-emerald-200">
                <UsersRound className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Join project workspace
                </CardTitle>
                <CardDescription className="mx-auto max-w-sm leading-6">
                  You have been invited to collaborate on a project. Join to access its chats, resources, and shared decisions.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Workspace invite ready</p>
                    <p className="mt-1 break-all text-xs leading-5 text-muted-foreground">
                      Code: {inviteCode}
                    </p>
                  </div>
                </div>
              </div>

              {error && (
                <div className="rounded-[8px] border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                <Button
                  onClick={handleJoin}
                  disabled={joining || !inviteCode}
                  className="h-11 rounded-[8px] font-semibold"
                  size="lg"
                >
                  {joining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Join project
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-[8px]"
                  onClick={() => router.push("/projects")}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}
