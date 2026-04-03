"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  Loader2,
  Mail,
  Sparkles,
  UserPlus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthContext } from "@/hooks/use-auth-context";
import { getIdToken } from "@/lib/firebase/auth";

type PublicProfile = {
  id: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  email: string | null;
  bio: string | null;
  working_on: string | null;
  skills: string[];
  project_links: string[];
  business_name: string | null;
  business_type: string | null;
  timezone: string;
  currency: string;
  plan: string | null;
};

type Relationship = {
  follow_request_status: "none" | "pending" | "accepted" | "rejected" | string;
  requested_at: string | null;
};

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

export default function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuthContext();
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [relationship, setRelationship] = useState<Relationship | null>(null);
  const [followLoading, setFollowLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ userId }) => setUserId(userId));
  }, [params]);

  useEffect(() => {
    if (!user || !userId) {
      return;
    }

    let isActive = true;

    async function loadUserProfile() {
      try {
        setLoading(true);
        setError(null);

        const token = await getIdToken();
        if (!token) {
          throw new Error("Missing auth token. Please sign in again.");
        }

        const response = await fetch(`/api/users/${userId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          const payload = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(payload.error || "Failed to load profile");
        }

        const data = (await response.json()) as {
          profile?: PublicProfile;
          relationship?: Relationship;
        };

        if (!isActive) {
          return;
        }

        setProfile(data.profile || null);
        setRelationship(data.relationship || null);
      } catch (err: unknown) {
        if (isActive) {
          setError(err instanceof Error ? err.message : "Failed to load profile");
        }
      } finally {
        if (isActive) {
          setLoading(false);
        }
      }
    }

    void loadUserProfile();

    return () => {
      isActive = false;
    };
  }, [user, userId]);

  const displayName = useMemo(() => {
    return profile?.full_name || profile?.username || user?.displayName || user?.email || "Rearvy member";
  }, [profile?.full_name, profile?.username, user?.displayName, user?.email]);

  async function sendFollowRequest() {
    if (!userId) {
      return;
    }

    try {
      setFollowLoading(true);
      setError(null);

      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token. Please sign in again.");
      }

      const response = await fetch(`/api/users/${userId}/follow-request`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; status?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Failed to send follow request");
      }

      setRelationship({
        follow_request_status: payload.status || "pending",
        requested_at: new Date().toISOString(),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send follow request");
    } finally {
      setFollowLoading(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Link href="/society/messages" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to messages
        </Link>
        <Card className="border-border/60 bg-card/80">
          <CardHeader>
            <CardTitle>User not found</CardTitle>
            <CardDescription>The profile you are looking for is not available.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const username = profile.username ? `@${profile.username}` : "Rearvy user";
  const skills = profile.skills;
  const links = profile.project_links;
  const isSelf = profile.id === user.uid;
  const requestStatus = relationship?.follow_request_status || "none";
  const contactEmail = profile.email || user.email || "Unknown";
  const followButtonLabel =
    requestStatus === "pending"
      ? "Request sent"
      : followLoading
        ? "Sending..."
        : "Send follow request";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/society/messages" className="inline-flex items-center text-sm text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to messages
      </Link>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-3xl border border-border/60 bg-card/95 shadow-sm">
        <div className="bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.15),transparent_42%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.12),transparent_35%)] p-6 sm:p-8 lg:p-10">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Public profile
              </div>

              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 rounded-2xl sm:h-20 sm:w-20">
                  <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-2xl text-lg font-semibold">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
                    {displayName}
                  </h1>
                  <p className="text-sm text-muted-foreground">{username}</p>
                  {profile.business_name && (
                    <p className="flex items-center gap-2 text-sm text-muted-foreground">
                      <BriefcaseBusiness className="h-4 w-4" />
                      {profile.business_name}
                    </p>
                  )}
                </div>
              </div>

              <p className="max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
                {profile.bio || "No bio added yet."}
              </p>

              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1">
                  {profile.timezone}
                </span>
                <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1">
                  {profile.currency}
                </span>
                {profile.business_type && (
                  <span className="rounded-full border border-border/70 bg-muted/50 px-3 py-1 capitalize">
                    {profile.business_type}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isSelf ? (
                  <Button asChild>
                    <Link href="/profile">Open your profile</Link>
                  </Button>
                ) : (
                  <Button onClick={() => void sendFollowRequest()} disabled={followLoading || requestStatus === "pending"}>
                    <UserPlus className="h-4 w-4" />
                    {followButtonLabel}
                  </Button>
                )}

                <Button asChild variant="outline">
                  <Link href="/society/messages">
                    <Users className="h-4 w-4" />
                    Back to conversations
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="border-border/60 bg-background/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl">Profile summary</CardTitle>
                <CardDescription>What this person has shared on Rearvy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Working on
                  </p>
                  <p className="mt-2 text-foreground">{profile.working_on || "Not shared yet."}</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Contact
                  </p>
                  <p className="mt-2 flex items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {contactEmail}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-2 text-foreground capitalize">
                    {requestStatus === "none" ? "No follow request sent" : requestStatus}
                  </p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    Profile links
                  </p>
                  <p className="mt-2 text-foreground">{links.length} shared link{links.length === 1 ? "" : "s"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">Skills</CardTitle>
            <CardDescription>Capabilities and focus areas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span key={skill} className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No skills shared yet.</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader>
            <CardTitle className="text-xl">Links</CardTitle>
            <CardDescription>Places this user wants to share.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {links.length > 0 ? (
              links.map((link) => (
                <a
                  key={link}
                  href={link}
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-2xl border border-border/60 bg-muted/30 px-4 py-3 text-sm transition hover:bg-muted/50"
                >
                  {link}
                </a>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No links shared yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}