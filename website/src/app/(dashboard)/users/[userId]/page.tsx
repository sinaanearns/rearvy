"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  AtSign,
  BriefcaseBusiness,
  CalendarClock,
  ExternalLink,
  Link2,
  Loader2,
  Mail,
  MapPin,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  Users,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ProfileEmptyState } from "@/components/profile/profile-empty-state";
import { useAuthContext } from "@/hooks/use-auth-context";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { getIdToken } from "@/lib/firebase/auth";
import {
  normalizeProfileAvatarUrl,
  normalizeProfileProjectLinks,
} from "@/lib/profile/profile-normalization";

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getNullableString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 30);
}

function getErrorMessage(payload: unknown, fallback: string) {
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

function readPublicProfile(value: unknown): PublicProfile | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = getString(value.id, "");
  if (!id) {
    return null;
  }

  return {
    id,
    full_name: normalizeRearvyDisplayText(value.full_name),
    username: getNullableString(value.username),
    avatar_url: normalizeProfileAvatarUrl(value.avatar_url),
    email: getNullableString(value.email),
    bio: getNullableString(value.bio),
    working_on: getNullableString(value.working_on),
    skills: getStringArray(value.skills),
    project_links: normalizeProfileProjectLinks(value.project_links),
    business_name: normalizeRearvyDisplayText(value.business_name),
    business_type: getNullableString(value.business_type),
    timezone: getString(value.timezone, "UTC"),
    currency: getString(value.currency, "USD"),
    plan: getNullableString(value.plan),
  };
}

function readRelationship(value: unknown): Relationship {
  if (!isRecord(value)) {
    return {
      follow_request_status: "none",
      requested_at: null,
    };
  }

  return {
    follow_request_status: getString(value.follow_request_status, "none"),
    requested_at: getNullableString(value.requested_at),
  };
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
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
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [authLoading, router, user]);

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

        const data = await readJson(response);
        if (!response.ok) {
          throw new Error(getErrorMessage(data, "Failed to load profile"));
        }

        if (!isActive) {
          return;
        }

        if (!isRecord(data)) {
          setProfile(null);
          setRelationship(null);
          return;
        }

        setProfile(readPublicProfile(data.profile));
        setRelationship(readRelationship(data.relationship));
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
    return (
      normalizeRearvyDisplayText(profile?.full_name) ||
      profile?.username ||
      normalizeRearvyDisplayText(user?.displayName) ||
      user?.email ||
      "Rearvy member"
    );
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

      const payload = await readJson(response);

      if (!response.ok) {
        throw new Error(getErrorMessage(payload, "Failed to send follow request"));
      }

      setRelationship({
        follow_request_status: isRecord(payload) ? getString(payload.status, "pending") : "pending",
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
      <div className="flex min-h-[calc(100vh-7rem)] items-center justify-center px-4">
        <div className="flex items-center gap-3 rounded-[8px] border border-border/70 bg-card/80 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading profile...
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (!profile) {
    return (
      <div className="mx-auto flex min-h-[calc(100vh-7rem)] max-w-3xl flex-col justify-center space-y-4 px-4 py-6 sm:px-6">
        <Link
          href="/chat"
          className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to messages
        </Link>
        <Card className="overflow-hidden rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03]">
          <div className="h-1 bg-gradient-to-r from-cyan-300 via-emerald-300 to-indigo-300" />
          <CardHeader className="space-y-2">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 text-cyan-600 dark:text-cyan-200">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl tracking-tight">User not found</CardTitle>
            <CardDescription className="leading-6">
              The profile you are looking for is not available or the invite no longer points to an active Rearvy member.
            </CardDescription>
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
  const profileStats = [
    { label: "Skills", value: skills.length.toString(), icon: Target },
    { label: "Links", value: links.length.toString(), icon: Link2 },
    { label: "Status", value: requestStatus === "none" ? "Open" : requestStatus, icon: ShieldCheck },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/chat"
        className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to messages
      </Link>

      {error && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200">
          {error}
        </div>
      )}

      <section className="overflow-hidden rounded-[8px] border border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-white/[0.04]">
        <div className="relative grid lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="relative overflow-hidden bg-slate-950 p-6 text-white sm:p-8 lg:p-10">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.22),transparent_34%),linear-gradient(315deg,rgba(99,102,241,0.18),transparent_30%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:60px_60px]" />
            <div className="relative space-y-6">
              <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1.5 text-xs font-medium text-cyan-100 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                Public profile
              </div>

              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16 rounded-[8px] border border-white/14 shadow-sm shadow-black/25 sm:h-20 sm:w-20">
                  <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                  <AvatarFallback className="rounded-[8px] bg-cyan-200/12 text-lg font-semibold text-cyan-50">
                    {getInitials(displayName)}
                  </AvatarFallback>
                </Avatar>

                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-balance text-white sm:text-4xl">
                    {displayName}
                  </h1>
                  <p className="flex items-center gap-2 text-sm text-white/60">
                    <AtSign className="h-3.5 w-3.5" aria-hidden="true" />
                    {username}
                  </p>
                  {profile.business_name && (
                    <p className="flex items-center gap-2 text-sm text-white/66">
                      <BriefcaseBusiness className="h-4 w-4" aria-hidden="true" />
                      {profile.business_name}
                    </p>
                  )}
                </div>
              </div>

              <p className="max-w-3xl text-sm leading-6 text-white/70 sm:text-base">
                {profile.bio || "No bio added yet."}
              </p>

              <div className="flex flex-wrap gap-2 text-xs text-white/66">
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1">
                  <MapPin className="h-3 w-3" aria-hidden="true" />
                  {profile.timezone}
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {profile.currency}
                </span>
                {profile.business_type && (
                  <span className="rounded-[8px] border border-white/12 bg-white/8 px-3 py-1 capitalize">
                    {profile.business_type}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {isSelf ? (
                  <Button asChild className="h-10 rounded-[8px] bg-white font-semibold text-slate-950 hover:bg-white/86">
                    <Link href="/profile">Open your profile</Link>
                  </Button>
                ) : (
                  <Button
                    onClick={() => void sendFollowRequest()}
                    disabled={followLoading || requestStatus === "pending"}
                    className="h-10 rounded-[8px] bg-white font-semibold text-slate-950 hover:bg-white/86"
                  >
                    <UserPlus className="h-4 w-4" />
                    {followButtonLabel}
                  </Button>
                )}

                <Button
                  asChild
                  variant="outline"
                  className="h-10 rounded-[8px] border-white/18 bg-white/8 text-white hover:bg-white/10 hover:text-white"
                >
                  <Link href="/chat">
                    <Users className="h-4 w-4" />
                    Back to conversations
                  </Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5 sm:p-6">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              {profileStats.map((stat) => {
                const Icon = stat.icon;

                return (
                  <div
                    key={stat.label}
                    className="group grid min-h-[78px] grid-cols-[40px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-border/70 bg-background/[0.78] p-3 shadow-sm shadow-slate-950/[0.03] transition-colors hover:border-cyan-200/45 dark:border-white/10 dark:bg-white/[0.05]"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 text-cyan-600 transition-transform group-hover:-translate-y-0.5 dark:text-cyan-200">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold capitalize text-foreground">
                        {stat.value}
                      </span>
                      <span className="mt-1 block truncate text-xs font-medium text-muted-foreground">
                        {stat.label}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>

            <Card className="rounded-[8px] border-border/70 bg-background/78 shadow-none dark:border-white/10 dark:bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-xl">Profile summary</CardTitle>
                <CardDescription>What this person has shared on Rearvy.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-medium text-muted-foreground">
                    Working on
                  </p>
                  <p className="mt-2 text-foreground">{profile.working_on || "Not shared yet."}</p>
                </div>

                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-medium text-muted-foreground">
                    Contact
                  </p>
                  <p className="mt-2 flex min-w-0 items-center gap-2 text-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="truncate">{contactEmail}</span>
                  </p>
                </div>

                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-medium text-muted-foreground">
                    Status
                  </p>
                  <p className="mt-2 text-foreground capitalize">
                    {requestStatus === "none" ? "No follow request sent" : requestStatus}
                  </p>
                </div>

                <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                  <p className="text-xs font-medium text-muted-foreground">
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
        <Card className="rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <CardHeader>
            <CardTitle className="text-xl">Skills</CardTitle>
            <CardDescription>Capabilities and focus areas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skills.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {skills.map((skill) => (
                  <span key={skill} className="rounded-[8px] border border-border/70 bg-muted/40 px-3 py-1 text-xs dark:border-white/10 dark:bg-white/[0.05]">
                    {skill}
                  </span>
                ))}
              </div>
            ) : (
              <ProfileEmptyState
                icon={Target}
                title="No skills shared yet"
                detail="This profile has not shared focus areas or capabilities yet."
                action={isSelf ? { href: "/settings", label: "Add skills" } : undefined}
                tone="cyan"
              />
            )}
          </CardContent>
        </Card>

        <Card className="rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
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
                  className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-muted/30 px-4 py-3 text-sm transition hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="truncate">{link}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </a>
              ))
            ) : (
              <ProfileEmptyState
                icon={Link2}
                title="No links shared yet"
                detail="Project, portfolio, or business links will appear here when this member adds them."
                action={isSelf ? { href: "/settings", label: "Add links" } : undefined}
                tone="emerald"
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
