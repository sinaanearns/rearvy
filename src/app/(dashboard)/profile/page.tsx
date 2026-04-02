"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth-provider";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Mail, MapPin, Pencil, User, Building2, Globe, Coins, BriefcaseBusiness, Sparkles } from "lucide-react";
import { DEFAULT_PLAN, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";

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
          throw new Error("Failed to load profile");
        }

        const data = (await response.json()) as { profile?: ProfileData };
        setProfile(data.profile || {});
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

  const displayName = profile.full_name || user.displayName || user.email || "Rearvy member";
  const username = profile.username || "@rearvy";
  const plan = profile.plan || DEFAULT_PLAN;
  const planLabel = REARVY_PLANS.find((entry) => entry.id === plan)?.name || plan;
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((item): item is string => typeof item === "string")
    : [];
  const links = Array.isArray(profile.project_links)
    ? profile.project_links.filter((item): item is string => typeof item === "string")
    : [];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Profile
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Your profile</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            A quick view of your account details, preferences, and profile identity.
          </p>
        </div>

        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/settings">
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Link>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="border-border/60 bg-card/80 backdrop-blur">
          <CardHeader className="items-center text-center">
            <Avatar className="h-24 w-24 rounded-3xl">
              <AvatarImage src={profile.avatar_url || undefined} alt={displayName} />
              <AvatarFallback className="rounded-3xl text-xl font-semibold">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="space-y-1 pt-3">
              <CardTitle className="text-2xl">{displayName}</CardTitle>
              <CardDescription>{username}</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-2xl border border-border/60 bg-muted/30 p-4 text-sm text-muted-foreground">
              {profile.bio || "No bio added yet."}
            </div>

            <div className="grid gap-3 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="h-4 w-4" /> Email
                </span>
                <span className="font-medium text-foreground">{user.email || "Unknown"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="h-4 w-4" /> Business
                </span>
                <span className="font-medium text-foreground">{profile.business_name || "Not set"}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Coins className="h-4 w-4" /> Plan
                </span>
                <span className="font-medium text-foreground">{planLabel}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-background/50 px-4 py-3">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Globe className="h-4 w-4" /> Timezone
                </span>
                <span className="font-medium text-foreground">{profile.timezone || "UTC"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">About you</CardTitle>
              <CardDescription>What you are working on and how Rearvy should frame your account.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                  Working on
                </p>
                <p className="mt-2 text-sm text-foreground">
                  {profile.working_on || "Not shared yet."}
                </p>
              </div>
              <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
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
            <Card className="border-border/60 bg-card/80 backdrop-blur">
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
                        className="rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-sm text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No skills added yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60 bg-card/80 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-xl">Project links</CardTitle>
                <CardDescription>Useful links you’ve added to your profile.</CardDescription>
              </CardHeader>
              <CardContent>
                {links.length > 0 ? (
                  <ul className="space-y-2 text-sm">
                    {links.map((link) => (
                      <li key={link} className="break-all rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
                        {link}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No links added yet.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="border-border/60 bg-card/80 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-xl">Profile summary</CardTitle>
              <CardDescription>Everything stored for this account in one place.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <SummaryTile label="Username" value={profile.username || "Not set"} icon={<User className="h-4 w-4" />} />
              <SummaryTile label="Business type" value={profile.business_type || "Not set"} icon={<BriefcaseBusiness className="h-4 w-4" />} />
              <SummaryTile label="Currency" value={profile.currency || "USD"} icon={<Coins className="h-4 w-4" />} />
              <SummaryTile label="Plan" value={planLabel} icon={<Sparkles className="h-4 w-4" />} />
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
    <div className="rounded-2xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-2 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}