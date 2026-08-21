"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MessageSquareText,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { getErrorMessage } from "@/lib/error-utils";

interface JoinPageProps {
  params: Promise<{ inviteCode: string }>;
}

type JoinChatResponse = {
  error?: unknown;
  chatId?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readJoinChatResponse(response: Response): Promise<JoinChatResponse> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    error: payload.error,
    chatId: payload.chatId,
  };
}

function getResponseError(payload: { error?: unknown }, fallback: string) {
  return typeof payload.error === "string" && payload.error.trim() ? payload.error : fallback;
}

export default function JoinPage({ params }: JoinPageProps) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [inviteCode, setInviteCode] = useState<string>("");
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ inviteCode }) => setInviteCode(inviteCode));
  }, [params]);

  useEffect(() => {
    if (!authLoading && inviteCode && !user) {
      router.replace(`/login?redirect=${encodeURIComponent(`/join/${inviteCode}`)}`);
    }
  }, [authLoading, inviteCode, router, user]);

  const handleJoin = async () => {
    if (!user || !inviteCode) return;

    setIsJoining(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/chat/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inviteCode }),
      });

      const data = await readJoinChatResponse(response);

      if (!response.ok) {
        throw new Error(getResponseError(data, "Failed to join chat"));
      }

      if (typeof data.chatId !== "string" || !data.chatId.trim()) {
        throw new Error("Join response did not include a chat id");
      }

      router.push(`/chat/${encodeURIComponent(data.chatId)}`);
    } catch (err) {
      setError(getErrorMessage(err, "An unexpected error occurred"));
    } finally {
      setIsJoining(false);
    }
  };

  if (authLoading || !inviteCode || !user) {
    return (
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-card/80 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preparing invite...
        </div>
      </div>
    );
  }

  return (
    <section className="mx-auto flex min-h-[calc(100vh-7rem)] w-full max-w-6xl items-center px-4 py-6 sm:px-6">
      <div className="grid w-full overflow-hidden rounded-[8px] border border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-slate-950 lg:grid-cols-[0.95fr_1.05fr]">
        <aside className="relative min-h-[420px] overflow-hidden bg-slate-950 p-6 text-white sm:p-8">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),transparent_34%),linear-gradient(315deg,rgba(99,102,241,0.2),transparent_34%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:60px_60px]" />
          <div className="relative flex h-full flex-col justify-between gap-10">
            <div className="space-y-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 shadow-sm shadow-black/25">
                <MessageSquareText className="h-6 w-6" aria-hidden="true" />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-medium text-cyan-200">
                  Shared conversation
                </p>
                <h1 className="max-w-md text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  Step into the client thread with context intact.
                </h1>
                <p className="max-w-md text-sm leading-6 text-white/66 sm:text-base">
                  Accept the invite to review earlier messages, continue decisions, and keep the next action visible to the team.
                </p>
              </div>
            </div>

            <div className="grid gap-3">
              {[
                ["History included", "Previous messages unlock after joining"],
                ["Team context", "Shared notes stay in one workspace"],
                ["Secure access", "Invite code is checked before entry"],
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
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 text-cyan-600 dark:text-cyan-200">
                <UsersRound className="h-7 w-7" aria-hidden="true" />
              </div>
              <div className="space-y-2">
                <CardTitle className="text-2xl font-semibold tracking-tight">
                  Join group chat
                </CardTitle>
                <CardDescription className="mx-auto max-w-sm leading-6">
                  You have been invited to join a group chat. Review the context, then continue the conversation with the team.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" aria-hidden="true" />
                  <div>
                    <p className="text-sm font-semibold text-foreground">Invite ready</p>
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
                  size="lg"
                  onClick={handleJoin}
                  disabled={isJoining || !inviteCode}
                  className="h-11 rounded-[8px] font-semibold"
                >
                  {isJoining ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Joining...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Join chat
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="h-11 rounded-[8px]"
                  onClick={() => router.push("/")}
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
