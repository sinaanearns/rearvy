"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import {
  Loader2,
  User,
  Building2,
  Bell,
  ShieldCheck,
  Globe,
  Coins,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
  ImagePlus,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_PLAN, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";
import {
  linkPasswordToCurrentUser,
  updateCurrentUserPassword,
} from "@/lib/firebase/auth";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState({
    full_name: "",
    username: "",
    bio: "",
    working_on: "",
    skills: [] as string[],
    project_links: [] as string[],
    business_name: "",
    business_type: "",
    timezone: "UTC",
    currency: "USD",
    plan: DEFAULT_PLAN as SubscriptionPlan,
    avatar_url: "",
  });
  const [skillsInput, setSkillsInput] = useState("");
  const [projectLinksInput, setProjectLinksInput] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { theme, setTheme } = useTheme();
  const hasPasswordProvider = Boolean(
    user?.providerData.some((provider) => provider.providerId === "password")
  );
  const hasGoogleProvider = Boolean(
    user?.providerData.some((provider) => provider.providerId === "google.com")
  );

  useEffect(() => {
    async function loadData() {
      if (!user) return;
      setLoading(true);
      try {
        const token = await user.getIdToken();
        setEmail(user.email || "");

        const response = await fetch("/api/dashboard/profile", {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) throw new Error("Failed to fetch profile");
        const data = await response.json();

        setProfile({
          full_name: data.profile.full_name || "",
          username: data.profile.username || "",
          bio: data.profile.bio || "",
          working_on: data.profile.working_on || "",
          skills: Array.isArray(data.profile.skills)
            ? data.profile.skills.filter((item: unknown) => typeof item === "string")
            : [],
          project_links: Array.isArray(data.profile.project_links)
            ? data.profile.project_links.filter((item: unknown) => typeof item === "string")
            : [],
          business_name: data.profile.business_name || "",
          business_type: data.profile.business_type || "",
          timezone: data.profile.timezone || "UTC",
          currency: data.profile.currency || "USD",
          plan: data.profile.plan || DEFAULT_PLAN,
          avatar_url: data.profile.avatar_url || "",
        });

        setSkillsInput(
          Array.isArray(data.profile.skills)
            ? data.profile.skills.filter((item: unknown) => typeof item === "string").join(", ")
            : ""
        );
        setProjectLinksInput(
          Array.isArray(data.profile.project_links)
            ? data.profile.project_links
                .filter((item: unknown) => typeof item === "string")
                .join("\n")
            : ""
        );
      } catch (error) {
        console.error("Error loading profile:", error);
        toast.error("Failed to load profile");
      } finally {
        setLoading(false);
      }
    }
    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (loading) {
      return;
    }

    if (typeof window === "undefined" || window.location.hash !== "#plan") {
      return;
    }

    document.getElementById("plan")?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [loading]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dashboard/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          full_name: profile.full_name,
          username: profile.username,
          avatar_url: profile.avatar_url,
          bio: profile.bio,
          working_on: profile.working_on,
          skills: skillsInput,
          project_links: projectLinksInput,
          business_name: profile.business_name,
          business_type: profile.business_type || null,
          timezone: profile.timezone,
          currency: profile.currency,
        }),
      });

      if (!response.ok) throw new Error("Failed to save profile");
      toast.success("Profile updated successfully");
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save changes"
      );
    } finally {
      setSaving(false);
    }
  }

  function getNameInitials(name: string) {
    const words = name
      .split(" ")
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 2);

    if (words.length === 0) return "R";
    return words.map((word) => word[0].toUpperCase()).join("");
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file.");
      return;
    }

    const maxSizeInBytes = 250 * 1024;
    if (file.size > maxSizeInBytes) {
      toast.error("Image is too large. Please upload one under 250KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        setProfile((prev) => ({ ...prev, avatar_url: result }));
      }
    };
    reader.onerror = () => {
      toast.error("Could not read selected image.");
    };
    reader.readAsDataURL(file);
  }

  async function handleUpdatePassword() {
    if (!user) return;

    if (passwordForm.next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    if (hasPasswordProvider && !passwordForm.current) {
      toast.error("Please enter your current password.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const result = hasPasswordProvider
        ? await updateCurrentUserPassword(passwordForm.current, passwordForm.next)
        : await linkPasswordToCurrentUser(passwordForm.next);

      if (result.error) {
        throw new Error(result.error);
      }

      toast.success(
        hasPasswordProvider
          ? "Password updated successfully."
          : "Password login enabled for this account. You can now sign in with email and password or Google."
      );
      setPasswordForm({ current: "", next: "" });
    } catch (error) {
      console.error("Error updating password:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to update password"
      );
    } finally {
      setUpdatingPassword(false);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and set your preferences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="flex overflow-x-auto no-scrollbar bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-4 sm:gap-6">
          <TabsTrigger
            value="profile"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="space-y-6 outline-none">
          <form onSubmit={handleSave} className="space-y-6">
            <Card
              id="plan"
              className="scroll-mt-24 border-none bg-accent/5 shadow-none dark:bg-accent/10"
            >
              <CardHeader>
                <CardTitle>Personal Information</CardTitle>
                <CardDescription>
                  This information will be displayed on your profile.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Profile Photo</Label>
                    <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background-muted/40 p-4 sm:flex-row sm:items-center">
                      <Avatar size="lg" className="h-20 w-20 rounded-2xl">
                        <AvatarImage src={profile.avatar_url || undefined} alt="Profile photo" />
                        <AvatarFallback className="rounded-2xl text-base font-semibold">
                          {getNameInitials(profile.full_name || profile.username || "Rearvy")}
                        </AvatarFallback>
                      </Avatar>

                      <div className="flex-1 space-y-2">
                        <Input
                          placeholder="Paste image URL (https://...)"
                          value={profile.avatar_url}
                          onChange={(e) =>
                            setProfile({ ...profile, avatar_url: e.target.value })
                          }
                          className="bg-background-muted shadow-none"
                        />
                        <div className="flex flex-wrap gap-2">
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm hover:bg-accent">
                            <ImagePlus className="h-4 w-4" />
                            Upload photo
                            <input
                              type="file"
                              accept="image/*"
                              onChange={handleAvatarUpload}
                              className="sr-only"
                            />
                          </label>
                          {profile.avatar_url && (
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => setProfile((prev) => ({ ...prev, avatar_url: "" }))}
                            >
                              Remove
                            </Button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic">
                          You can paste an image URL or upload a small image under 250KB.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="fullName">Full Name</Label>
                    <Input
                      id="fullName"
                      placeholder="Jane Doe"
                      value={profile.full_name}
                      onChange={(e) =>
                        setProfile({ ...profile, full_name: e.target.value })
                      }
                      className="bg-background-muted shadow-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      placeholder="e.g. jane_doe"
                      value={profile.username}
                      onChange={(e) =>
                        setProfile({ ...profile, username: e.target.value })
                      }
                      className="bg-background-muted shadow-none"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Used for direct messaging with Rearvy users.
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="bio">About You</Label>
                    <Textarea
                      id="bio"
                      placeholder="Tell others about yourself, your background, and your interests."
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      className="min-h-24 bg-background-muted shadow-none"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="workingOn">What You Are Working On</Label>
                    <Textarea
                      id="workingOn"
                      placeholder="Share your current projects, goals, or what you are building right now."
                      value={profile.working_on}
                      onChange={(e) =>
                        setProfile({ ...profile, working_on: e.target.value })
                      }
                      className="min-h-20 bg-background-muted shadow-none"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="skills">What You Are Good With</Label>
                    <Input
                      id="skills"
                      placeholder="React, Firebase, Marketing, Product Strategy"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      className="bg-background-muted shadow-none"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Separate skills with commas.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="projectLinks">Project Links</Label>
                    <Textarea
                      id="projectLinks"
                      placeholder={"https://github.com/yourname/project-one\nhttps://yourportfolio.com"}
                      value={projectLinksInput}
                      onChange={(e) => setProjectLinksInput(e.target.value)}
                      className="min-h-24 bg-background-muted shadow-none"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Add one link per line (website, GitHub, demo, portfolio, etc.).
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      value={email}
                      disabled
                      className="bg-muted/50 cursor-not-allowed shadow-none"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Email cannot be changed.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
              <CardHeader>
                <CardTitle>Business Details</CardTitle>
                <CardDescription>
                  Information about your business or brand.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="businessName">Business Name</Label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="businessName"
                        placeholder="e.g. My Brand"
                        value={profile.business_name}
                        onChange={(e) =>
                          setProfile({
                            ...profile,
                            business_name: e.target.value,
                          })
                        }
                        className="pl-10 bg-background-muted shadow-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="businessType">Business Type</Label>
                    <Select
                      value={profile.business_type}
                      onValueChange={(value) =>
                        setProfile({ ...profile, business_type: value })
                      }
                    >
                      <SelectTrigger className="bg-background-muted shadow-none">
                        <SelectValue placeholder="Select business type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="shopify">Shopify Store</SelectItem>
                        <SelectItem value="content_creator">
                          Content Creator
                        </SelectItem>
                        <SelectItem value="agency">Agency</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={profile.timezone}
                      onValueChange={(value) =>
                        setProfile({ ...profile, timezone: value })
                      }
                    >
                      <SelectTrigger className="bg-background-muted shadow-none">
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select timezone" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="UTC">UTC (Universal Time)</SelectItem>
                        <SelectItem value="EST">
                          EST (Eastern Standard Time)
                        </SelectItem>
                        <SelectItem value="PST">
                          PST (Pacific Standard Time)
                        </SelectItem>
                        <SelectItem value="GMT">
                          GMT (Greenwich Mean Time)
                        </SelectItem>
                        <SelectItem value="IST">
                          IST (India Standard Time)
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Currency</Label>
                    <Select
                      value={profile.currency}
                      onValueChange={(value) =>
                        setProfile({ ...profile, currency: value })
                      }
                    >
                      <SelectTrigger className="bg-background-muted shadow-none">
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-muted-foreground" />
                          <SelectValue placeholder="Select currency" />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (Euro)</SelectItem>
                        <SelectItem value="GBP">GBP (Pound)</SelectItem>
                        <SelectItem value="INR">INR (Rupee)</SelectItem>
                        <SelectItem value="CAD">CAD ($)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
              <CardHeader>
                <CardTitle>Plan</CardTitle>
                <CardDescription>
                  You are on the Free plan with full access to all features.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-primary bg-background shadow-sm p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">Free</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        AI-powered business assistant with Kimi 2.5
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold">$0</div>
                      <div className="text-xs text-muted-foreground">/month</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {REARVY_PLANS[0].features.map((feature) => (
                      <div
                        key={feature}
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <Check className="h-4 w-4 text-primary" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button type="submit" size="lg" disabled={saving}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save all changes
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="appearance" className="space-y-6 outline-none">
          <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
            <CardHeader>
              <CardTitle>Theme</CardTitle>
              <CardDescription>
                Choose how Rearvy looks on your device.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                {/* Light */}
                <button
                  onClick={() => setTheme("light")}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:border-primary/60",
                    theme === "light" ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex h-14 w-full items-center justify-center rounded-lg bg-white border">
                    <Sun className="h-6 w-6 text-amber-500" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      theme === "light" && "text-primary"
                    )}
                  >
                    Light
                  </span>
                </button>

                {/* Dark */}
                <button
                  onClick={() => setTheme("dark")}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:border-primary/60",
                    theme === "dark" ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 border border-zinc-700">
                    <Moon className="h-6 w-6 text-blue-400" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      theme === "dark" && "text-primary"
                    )}
                  >
                    Dark
                  </span>
                </button>

                {/* System */}
                <button
                  onClick={() => setTheme("system")}
                  className={cn(
                    "flex flex-col items-center gap-3 rounded-xl border-2 p-4 transition-all hover:border-primary/60",
                    theme === "system" ? "border-primary bg-primary/5" : "border-muted"
                  )}
                >
                  <div className="flex h-14 w-full items-center justify-center rounded-lg bg-gradient-to-r from-white to-zinc-900 border">
                    <Monitor className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <span
                    className={cn(
                      "text-sm font-medium",
                      theme === "system" && "text-primary"
                    )}
                  >
                    System
                  </span>
                </button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>


        <TabsContent value="notifications">
          <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>
                Configure how you receive updates and alerts.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Critical integration alerts are enabled by default.
              </p>
              <p className="text-xs text-muted-foreground">
                Granular notification preferences are not configurable yet.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                {hasPasswordProvider
                  ? "Manage your password and security settings."
                  : "Add password login to this account so the same email works with both Google and normal sign-in."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {hasPasswordProvider && (
                <div className="space-y-2">
                  <Label htmlFor="currentPass">Current Password</Label>
                  <Input
                    id="currentPass"
                    type="password"
                    value={passwordForm.current}
                    onChange={(e) =>
                      setPasswordForm((prev) => ({
                        ...prev,
                        current: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter your current password to confirm the change.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="newPass">
                  {hasPasswordProvider ? "New Password" : "Create Password"}
                </Label>
                <Input
                  id="newPass"
                  type="password"
                  value={passwordForm.next}
                  onChange={(e) =>
                    setPasswordForm((prev) => ({
                      ...prev,
                      next: e.target.value,
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  {hasPasswordProvider
                    ? "Use at least 8 characters."
                    : hasGoogleProvider
                      ? "Use at least 8 characters. This adds password login to your existing Google account."
                      : "Use at least 8 characters."}
                </p>
              </div>
              <Button
                variant="outline"
                type="button"
                onClick={handleUpdatePassword}
                disabled={updatingPassword}
              >
                {updatingPassword && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {hasPasswordProvider ? "Update Password" : "Enable Password Login"}
              </Button>

              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                <p className="text-sm font-medium text-destructive">Data deletion</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permanently remove your account data, integrations, and chat history.
                </p>
                <Button asChild variant="destructive" className="mt-3">
                  <Link href="/data-delete">Delete all my data</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
