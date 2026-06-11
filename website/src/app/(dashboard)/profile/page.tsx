"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
import {
  AtSign,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  Coins,
  ExternalLink,
  Globe,
  Link2,
  Loader2,
  Mail,
  MapPin,
  Pencil,
  Sparkles,
  Target,
  User,
} from "lucide-react";
import { DEFAULT_PLAN, FREE_PLAN_CREDITS, FREE_PLAN_CREDITS_LABEL, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";
import { normalizeHttpUrl } from "@/lib/chat/url-normalization";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { ProfileEmptyState } from "@/components/profile/profile-empty-state";

type ProfileData = {
  full_name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  bio?: string | null;
  working_on?: string | null;
  skills?: string[] | null;
  project_links?: string[] | null;
  business_name?: string | null;
  business_type?: string | null;
  timezone?: string | null;
  currency?: string | null;
  plan?: SubscriptionPlan | null;
  credits?: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "free" || value === "pro" || value === "business";
}

function getString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getStringArray(value: unknown, limit = 20) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, limit);
}

function getProjectLinks(value: unknown) {
  return getStringArray(value)
    .map(normalizeHttpUrl)
    .filter((link): link is string => Boolean(link));
}

function getProfileData(value: unknown): ProfileData {
  if (!isRecord(value)) {
    return {};
  }

  return {
    full_name: normalizeRearvyDisplayText(value.full_name),
    username: getString(value.username),
    avatar_url: getString(value.avatar_url),
    bio: getString(value.bio),
    working_on: getString(value.working_on),
    skills: getStringArray(value.skills),
    project_links: getProjectLinks(value.project_links),
    business_name: normalizeRearvyDisplayText(value.business_name),
    business_type: getString(value.business_type),
    timezone: getString(value.timezone),
    currency: getString(value.currency),
    plan: isSubscriptionPlan(value.plan) ? value.plan : null,
    credits: typeof value.credits === "number" && Number.isFinite(value.credits)
      ? Math.max(0, Math.floor(value.credits))
      : null,
  };
}

async function readProfileResponse(response: Response): Promise<ProfileData> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return getProfileData(payload.profile);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
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

export default function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileData>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      if (!user) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const token = await user.getIdToken();
        const response = await fetch("/api/dashboard/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to load profile"));
        }

        const profile = await readProfileResponse(response);
        setProfile(profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        setLoading(false);
      }
    }

    if (user) {
      void loadProfile();
    }
  }, [user]);

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

  const displayName =
    normalizeRearvyDisplayText(profile.full_name) ||
    normalizeRearvyDisplayText(user.displayName) ||
    user.email ||
    "Rearvy member";
  const username = profile.username || "@rearvy";
  const plan = profile.plan || DEFAULT_PLAN;
  const planLabel = REARVY_PLANS.find((entry) => entry.id === plan)?.name || plan;
  const credits = typeof profile.credits === "number" ? profile.credits : FREE_PLAN_CREDITS;
  const creditsLabel = plan === DEFAULT_PLAN
    ? FREE_PLAN_CREDITS_LABEL
    : `${credits.toLocaleString("en-US")} credits`;
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((item): item is string => typeof item === "string")
    : [];
  const links = Array.isArray(profile.project_links)
    ? profile.project_links.filter((item): item is string => typeof item === "string")
    : [];
  const profileHighlights = [
    {
      label: "Plan",
      value: planLabel,
      detail: creditsLabel,
      icon: Sparkles,
    },
    {
      label: "Business",
      value: profile.business_name || "Not set",
      detail: profile.business_type || "No type selected",
      icon: Building2,
    },
    {
      label: "Timezone",
      value: profile.timezone || "UTC",
      detail: profile.currency || "USD",
      icon: Globe,
    },
  ];
  const profileDetails = [
    {
      label: "Email",
      value: user.email || "Unknown",
      icon: Mail,
    },
    {
      label: "Business",
      value: profile.business_name || "Not set",
      icon: Building2,
    },
    {
      label: "Plan",
      value: planLabel,
      icon: Sparkles,
    },
    {
      label: "Credits",
      value: creditsLabel,
      icon: Coins,
    },
    {
      label: "Timezone",
      value: profile.timezone || "UTC",
      icon: Globe,
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <DashboardPageHero
        eyebrow="Profile"
        title="Your profile"
        description="Review the identity, business context, and account signals Rearvy uses to personalize the workspace."
        icon={User}
        accent="amber"
        metrics={profileHighlights.map((item) => ({
          label: item.label,
          value: item.value,
          detail: item.detail,
          icon: item.icon,
        }))}
        actions={
          <Button asChild variant="outline" className="rounded-[8px]">
            <Link href="/settings">
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Link>
          </Button>
        }
      />

      {error && (
        <div className="rounded-[8px] border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <Card className="overflow-hidden rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          <div className="relative overflow-hidden bg-slate-950 p-6 text-white">
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(247,201,72,0.18),transparent_34%),linear-gradient(315deg,rgba(105,215,255,0.16),transparent_32%)]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:52px_52px]" />
            <CardHeader className="relative items-center px-0 pb-0 pt-0 text-center">
              <Avatar className="h-24 w-24 rounded-[8px] border border-white/16 shadow-sm shadow-black/25">
                <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
                <AvatarFallback className="rounded-[8px] bg-amber-200/12 text-xl font-semibold text-amber-50">
                  {getInitials(displayName)}
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 pt-4">
                <div className="mx-auto inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1 text-xs font-medium text-amber-100">
                  <User className="h-3.5 w-3.5" aria-hidden="true" />
                  Profile identity
                </div>
                <CardTitle className="break-words text-balance text-2xl text-white">{displayName}</CardTitle>
                <CardDescription className="flex min-w-0 items-center justify-center gap-1.5 text-white/64">
                  <AtSign className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-all">{username}</span>
                </CardDescription>
              </div>
              <div className="mt-5 flex flex-wrap justify-center gap-2 text-xs text-white/68">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1">
                  <BriefcaseBusiness className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{profile.business_type || "Business type not set"}</span>
                </span>
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-[8px] border border-white/12 bg-white/8 px-3 py-1">
                  <CalendarClock className="h-3 w-3 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">{profile.timezone || "UTC"}</span>
                </span>
              </div>
            </CardHeader>
          </div>

          <CardContent className="space-y-4 p-5">
            {profile.bio ? (
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
                <p className="mb-2 text-xs font-medium text-muted-foreground">
                  Profile note
                </p>
                {profile.bio}
              </div>
            ) : (
              <ProfileEmptyState
                icon={User}
                title="No bio added yet"
                detail="Add a short profile note so Rearvy can personalize workspace context and handoffs around your work."
                action={{ href: "/settings", label: "Add profile note" }}
                tone="amber"
              />
            )}

            <div className="grid gap-3 text-sm">
              {profileDetails.map((detail) => {
                const Icon = detail.icon;

                return (
                  <div
                    key={detail.label}
                    className="group grid min-h-12 grid-cols-[32px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-border/70 bg-background/[0.76] px-3 py-2 shadow-sm shadow-slate-950/[0.02] transition-colors hover:border-amber-200/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-amber-200/28"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-amber-200/30 bg-amber-200/10 text-amber-600 transition-transform group-hover:-translate-y-0.5 dark:text-amber-100">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-muted-foreground">
                        {detail.label}
                      </span>
                      <span className="mt-0.5 block truncate font-medium text-foreground">
                        {detail.value}
                      </span>
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="overflow-hidden rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
            <div className="h-px bg-gradient-to-r from-transparent via-amber-300/55 to-transparent dark:via-amber-200/28" />
            <CardHeader>
              <CardTitle className="text-xl">About you</CardTitle>
              <CardDescription>What you are working on and how Rearvy should frame your account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-medium text-muted-foreground">
                  Working on
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {profile.working_on || "Not shared yet."}
                </p>
              </div>
              <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
                <p className="text-xs font-medium text-muted-foreground">
                  Location
                </p>
                <p className="mt-2 flex items-center gap-2 text-sm text-foreground">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  {profile.timezone || "UTC"}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-xl">Skills</CardTitle>
                <CardDescription>Capabilities tied to your profile.</CardDescription>
              </CardHeader>
              <CardContent>
                {skills.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-[8px] border border-border/70 bg-muted/40 px-3 py-1 text-sm text-foreground dark:border-white/10 dark:bg-white/[0.05]"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <ProfileEmptyState
                    icon={Target}
                    title="No skills added yet"
                    detail="Add skills in settings so Rearvy can frame the workspace around your strengths."
                    action={{ href: "/settings", label: "Add skills" }}
                    tone="cyan"
                  />
                )}
              </CardContent>
            </Card>

            <Card className="rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
              <CardHeader>
                <CardTitle className="text-xl">Project links</CardTitle>
                <CardDescription>Useful links you've added to your profile.</CardDescription>
              </CardHeader>
              <CardContent>
                {links.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {links.map((link) => (
                      <li key={link}>
                        <a
                          href={link}
                          target="_blank"
                          rel="noreferrer"
                          className="flex min-w-0 items-center justify-between gap-3 rounded-[8px] border border-border/70 bg-muted/30 px-4 py-3 text-foreground transition hover:border-cyan-200/50 hover:bg-muted/50 dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-cyan-200/28"
                        >
                          <span className="min-w-0 break-all text-cyan-700 underline-offset-4 hover:underline dark:text-cyan-200">
                            {link}
                          </span>
                          <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ProfileEmptyState
                    icon={Link2}
                    title="No links added yet"
                    detail="Add project links to keep useful business context one click away."
                    action={{ href: "/settings", label: "Add links" }}
                    tone="emerald"
                  />
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="rounded-[8px] border-border/70 bg-card/85 shadow-sm shadow-slate-950/[0.03] backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
            <CardHeader>
              <CardTitle className="text-xl">Profile summary</CardTitle>
              <CardDescription>Everything stored for this account in one place.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryTile label="Username" value={profile.username || "Not set"} icon={<User className="h-4 w-4" />} />
              <SummaryTile label="Business type" value={profile.business_type || "Not set"} icon={<BriefcaseBusiness className="h-4 w-4" />} />
              <SummaryTile label="Currency" value={profile.currency || "USD"} icon={<Coins className="h-4 w-4" />} />
              <SummaryTile label="Plan" value={planLabel} icon={<Sparkles className="h-4 w-4" />} />
              <SummaryTile label="Credits" value={creditsLabel} icon={<Coins className="h-4 w-4" />} />
              <SummaryTile label="Email" value={user.email || "Unknown"} icon={<Mail className="h-4 w-4" />} />
              <SummaryTile label="Avatar" value={profile.avatar_url ? "Set" : "Not set"} icon={<User className="h-4 w-4" />} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryTile({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-[8px] border border-border/70 bg-muted/30 p-4 dark:border-white/10 dark:bg-white/[0.04]">
      <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
