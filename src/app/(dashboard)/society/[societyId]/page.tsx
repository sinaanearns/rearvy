"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Loader2, Sparkles } from "lucide-react";

import { useAuthContext } from "@/hooks/use-auth-context";
import { getIdToken } from "@/lib/firebase/auth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface Society {
  id: string;
  name: string;
  description: string | null;
  category: string;
  status: string;
  stage?: string | null;
  founder_id?: string;
  member_count: number;
  total_revenue?: number;
  team_preview?: TeamPreviewMember[];
  viewer_is_member?: boolean;
  access_level?: "public" | "member";
}

interface TeamPreviewMember {
  id: string;
  user_id: string;
  role: string;
  display_name: string;
  username?: string | null;
  avatar_url?: string | null;
}

interface Member {
  id: string;
  user_id: string;
  ownership_percent: number;
  role: string;
  status: string;
}

const stageCopy: Record<string, { label: string; note: string }> = {
  formation: {
    label: "Early build",
    note: "The idea is defined and the project is being organized.",
  },
  building: {
    label: "Active build",
    note: "The core experience is live and the project is ready for contributors.",
  },
  scaling: {
    label: "Growing",
    note: "The project is working and now needs more people and momentum.",
  },
  exiting: {
    label: "Final phase",
    note: "The project is mature and focused on long-term outcomes.",
  },
};

const checklist = [
  "Rearvy unifies data from different business channels into one view.",
  "AI highlights patterns, risks, and opportunities from the incoming data.",
  "Teams get clear summaries and practical next-step recommendations.",
  "Contributors can help improve data quality, models, and execution.",
];

export default function SocietyDetailPage({
  params,
}: {
  params: Promise<{ societyId: string }>;
}) {
  const router = useRouter();
  const { user } = useAuthContext();
  const [societyId, setSocietyId] = useState("");
  const [society, setSociety] = useState<Society | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [requestLoading, setRequestLoading] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState(false);

  const teamPreview = society?.team_preview || [];

  useEffect(() => {
    params.then(({ societyId }) => setSocietyId(societyId));
  }, [params]);

  useEffect(() => {
    if (!societyId) {
      return;
    }

    async function fetchSociety() {
      try {
        setLoading(true);
        const token = user ? await getIdToken() : null;

        const societyRes = await fetch(`/api/societies/${societyId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });

        if (!societyRes.ok) {
          throw new Error("Failed to load project details");
        }

        const societyData = await societyRes.json();
        setSociety(societyData);

        if (societyData.viewer_is_member && token) {
          const membersRes = await fetch(`/api/societies/${societyId}/members`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (membersRes.ok) {
            const membersData = await membersRes.json();
            setMembers(membersData.members || []);
          }
        } else {
          setMembers([]);
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Failed to load project details");
      } finally {
        setLoading(false);
      }
    }

    fetchSociety();
  }, [societyId, user]);

  const isMember = Boolean(society?.viewer_is_member);
  const stageDetails = useMemo(() => {
    if (!society?.stage) {
      return {
        label: "Active project",
        note: "The project is live and ready for people who want to contribute.",
      };
    }

    return stageCopy[society.stage] || {
      label: "Active project",
      note: "The project is live and ready for people who want to contribute.",
    };
  }, [society?.stage]);

  async function handleJoinRequest(e: React.FormEvent) {
    e.preventDefault();

    if (!user) {
      router.push(`/society/login?redirect=${encodeURIComponent(`/society/${societyId}`)}`);
      return;
    }

    setRequestLoading(true);
    setRequestError(null);
    setRequestSuccess(false);

    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token. Please sign in again.");
      }

      const response = await fetch(`/api/societies/${societyId}/join-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message: requestMessage }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send request");
      }

      setRequestSuccess(true);
      setRequestMessage("");
    } catch (err: unknown) {
      setRequestError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setRequestLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !society) {
    return (
      <div className="mx-auto max-w-2xl">
        <Link href="/society" className="mb-6 inline-flex items-center text-sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to published businesses
        </Link>
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-900">Error</CardTitle>
          </CardHeader>
          <CardContent className="text-red-800">
            {error || "Project not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/society" className="inline-flex items-center text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to published businesses
      </Link>

      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_35%)] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.3fr_0.9fr] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Rearvy Project
              </div>
              <div className="space-y-3">
                <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-5xl">
                  {society.name}
                </h1>
                <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                  Rearvy is an AI-based data analysis platform built to help businesses understand what is happening,
                  why it is happening, and what to do next. It connects your data, turns it into clear insights,
                  and helps teams make faster, better decisions.
                </p>
              </div>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1">{society.category}</span>
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1 capitalize">{society.status}</span>
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1">{stageDetails.label}</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <Card className="border-border/70 bg-background/80">
                  <CardHeader className="space-y-1 pb-3">
                    <CardDescription>Community size</CardDescription>
                    <CardTitle className="text-2xl">{society.member_count}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-border/70 bg-background/80">
                  <CardHeader className="space-y-1 pb-3">
                    <CardDescription>Project state</CardDescription>
                    <CardTitle className="text-lg">{stageDetails.label}</CardTitle>
                  </CardHeader>
                </Card>
                <Card className="border-border/70 bg-background/80">
                  <CardHeader className="space-y-1 pb-3">
                    <CardDescription>Progress</CardDescription>
                    <CardTitle className="text-lg">Live and growing</CardTitle>
                  </CardHeader>
                </Card>
              </div>
            </div>

            <Card className="border-primary/20 bg-background/90 shadow-md">
              <CardHeader>
                <CardTitle className="text-xl">What this project is</CardTitle>
                <CardDescription>
                  A simple overview of how Rearvy works and the value it gives to businesses.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm text-muted-foreground">
                <p>{stageDetails.note}</p>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-2xl border border-border/60 bg-card/70 px-3 py-2 text-foreground">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>How much is done</CardTitle>
            <CardDescription>
              The foundation is live. The next phase is expanding integrations, models, and delivery speed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Rearvy already has a working product direction, a public project page, and a contributor flow for people who want to help build.
            </p>
            <p>
              What remains is scaling integrations, improving AI insight quality, and adding specialists who can accelerate product and growth.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>What we want from you</CardTitle>
            <CardDescription>
              Tell the admin what you can bring to the project.
            </CardDescription>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Share how you can help with data pipelines, analytics, AI workflows, product, distribution, or customer adoption.
            </p>
          </CardContent>
        </Card>
      </section>

      <section>
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>Who is working on this</CardTitle>
            <CardDescription>
              Current active contributors building this project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {teamPreview.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {teamPreview.map((member) => (
                  <div key={member.id} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <p className="font-medium text-foreground">{member.display_name}</p>
                    <p className="mt-1 text-xs uppercase tracking-wide text-muted-foreground capitalize">
                      {member.role}
                    </p>
                    {member.username ? (
                      <p className="mt-1 text-sm text-muted-foreground">@{member.username.replace(/^@+/, "")}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
                Contributors are being onboarded. Names will appear here as members become active.
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>Project snapshot</CardTitle>
            <CardDescription>
              A plain-language summary of where the project stands.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="font-medium text-foreground">What it is</p>
              <p className="mt-1">
                Rearvy is an AI-powered data analysis platform that helps businesses combine data, spot patterns, and act with confidence.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="font-medium text-foreground">What is already live</p>
              <p className="mt-1">
                The project direction, collaboration flow, and contributor request path are already live for community participation.
              </p>
            </div>
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
              <p className="font-medium text-foreground">What comes next</p>
              <p className="mt-1">
                Better data connectors, stronger AI recommendations, and tighter execution loops with the right contributors.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-card/95 shadow-sm">
          <CardHeader>
            <CardTitle>Tell the admin what you can provide</CardTitle>
            <CardDescription>
              This goes to the admin for review before anyone is added to the project.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {requestSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                Your message was sent. The admin will review it and follow up if there is a fit.
              </div>
            ) : (
              <form onSubmit={handleJoinRequest} className="space-y-4">
                <div className="space-y-2">
                  <Textarea
                    value={requestMessage}
                    onChange={(e) => setRequestMessage(e.target.value)}
                    placeholder="Example: I can help build analytics dashboards, improve AI insight prompts, integrate data sources, or support growth."
                    rows={6}
                    minLength={20}
                    required
                  />
                </div>

                {requestError && (
                  <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                    {requestError}
                  </div>
                )}

                {!user ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    Sign in to send your request to the admin.
                  </div>
                ) : null}

                <Button type="submit" disabled={requestLoading} className="w-full justify-between">
                  {requestLoading ? (
                    <>
                      Sending...
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </>
                  ) : (
                    <>
                      Send to admin
                      <ArrowLeft className="h-4 w-4 rotate-180" />
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </section>

      {isMember && (
        <Card className="border-border/70 bg-card/95">
          <CardHeader>
            <CardTitle>Member view</CardTitle>
            <CardDescription>
              Internal details for active members only.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              Members can see the project structure, ownership, and contribution details after they are added.
            </p>
            <div className="grid gap-3 md:grid-cols-2">
              {members.length > 0 ? (
                members
                  .filter((member) => member.status === "active")
                  .map((member) => (
                    <div key={member.id} className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                      <p className="font-medium text-foreground capitalize">{member.role}</p>
                      <p className="mt-1">{member.ownership_percent.toFixed(1)}% ownership</p>
                    </div>
                  ))
              ) : (
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  No member records were loaded yet.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
