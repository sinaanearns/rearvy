"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Settings2,
  Bell,
  ShieldCheck,
  Link2,
  Globe,
  Coins,
  Check,
  Sun,
  Moon,
  Monitor,
  Palette,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DEFAULT_PLAN, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";
import { startProCheckout } from "@/lib/billing/client";

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState({
    full_name: "",
    business_name: "",
    business_type: "",
    timezone: "UTC",
    currency: "USD",
    plan: DEFAULT_PLAN as SubscriptionPlan,
    avatar_url: "",
  });
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [upgradingPlan, setUpgradingPlan] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    current: "",
    next: "",
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const { theme, setTheme } = useTheme();

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
          business_name: data.profile.business_name || "",
          business_type: data.profile.business_type || "",
          timezone: data.profile.timezone || "UTC",
          currency: data.profile.currency || "USD",
          plan: data.profile.plan || DEFAULT_PLAN,
          avatar_url: data.profile.avatar_url || "",
        });
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
          business_name: profile.business_name,
          business_type: profile.business_type || null,
          timezone: profile.timezone,
          currency: profile.currency,
          plan: profile.plan,
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

  async function handleUpgradeToPro() {
    if (!user) {
      return;
    }

    setUpgradingPlan(true);

    try {
      const verifiedPayment = await startProCheckout({
        email: user.email,
        fullName: profile.full_name || user.displayName || "",
        source: "settings",
      });

      const token = await user.getIdToken();
      const response = await fetch("/api/billing/activate-pro", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          verificationId: verifiedPayment.verificationId,
        }),
      });

      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error || "Unable to activate Pro.");
      }

      setProfile((current) => ({
        ...current,
        plan: "pro",
      }));
      toast.success(`Pro activated. Payment verified via ${verifiedPayment.method}.`);
    } catch (error) {
      console.error("Error upgrading plan:", error);
      toast.error(
        error instanceof Error ? error.message : "Unable to upgrade to Pro."
      );
    } finally {
      setUpgradingPlan(false);
    }
  }

  async function handleUpdatePassword() {
    if (!user) return;

    if (!email) {
      toast.error("Could not determine account email.");
      return;
    }

    if (!passwordForm.current || !passwordForm.next) {
      toast.error("Please enter current and new password.");
      return;
    }

    if (passwordForm.next.length < 8) {
      toast.error("New password must be at least 8 characters.");
      return;
    }

    setUpdatingPassword(true);
    try {
      const token = await user.getIdToken();
      
      // Firebase doesn't require reauthentication on the client for password changes
      // The admin SDK will handle verification on the backend
      const response = await fetch("/api/dashboard/profile/password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_password: passwordForm.next,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update password");
      }

      toast.success("Password updated successfully.");
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
        <TabsList className="bg-transparent border-b rounded-none w-full justify-start h-auto p-0 gap-6">
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
            value="account"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <Settings2 className="mr-2 h-4 w-4" />
            Account
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
                  Choose the workspace plan attached to this account.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  {REARVY_PLANS.map((planOption) => {
                    const selected = profile.plan === planOption.id;
                    const isUpgradeOption =
                      planOption.id === "pro" && profile.plan !== "pro";

                    return (
                      <button
                        key={planOption.id}
                        type="button"
                        onClick={() => {
                          if (planOption.id === "pro" && profile.plan !== "pro") {
                            void handleUpgradeToPro();
                            return;
                          }

                          setProfile({
                            ...profile,
                            plan: planOption.id,
                          });
                        }}
                        className={cn(
                          "rounded-2xl border p-5 text-left transition-all",
                          selected
                            ? "border-primary bg-background shadow-sm"
                            : "border-border/60 bg-background/70 hover:border-primary/40"
                        )}
                      >
                        <div className="mb-4 flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-semibold">
                                {planOption.name}
                              </span>
                              {planOption.badge && (
                                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-[0.2em] text-primary">
                                  {planOption.badge}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground">
                              {planOption.description}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {planOption.price}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {planOption.period}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {planOption.features.map((feature) => (
                            <div
                              key={feature}
                              className="flex items-center gap-2 text-sm text-muted-foreground"
                            >
                              <Check className="h-4 w-4 text-primary" />
                              <span>{feature}</span>
                            </div>
                          ))}
                        </div>

                        {planOption.paymentRequired && (
                          <div className="mt-4 rounded-xl border border-primary/15 bg-primary/5 px-3 py-2 text-xs text-muted-foreground">
                            {isUpgradeOption
                              ? "Upgrade opens secure checkout with UPI and card options."
                              : "This plan is protected by verified billing."}
                          </div>
                        )}

                        {isUpgradeOption && (
                          <div className="mt-4">
                            <div className="inline-flex items-center rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground">
                              {upgradingPlan && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Upgrade with UPI or card
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-muted-foreground">
                  Free-to-Pro upgrades now go through verified checkout. Saving this form will not bypass billing.
                </p>
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

        <TabsContent value="account">
          <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
              <CardDescription>
                Review your account connection status and basic settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between p-4 rounded-lg bg-background shadow-sm border">
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 flex items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Link2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium">Connected Store</p>
                    <p className="text-sm text-muted-foreground">Shopify</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  Manage
                </Button>
              </div>

              <Separator />

              <div className="space-y-4">
                <h3 className="font-medium text-destructive">Danger Zone</h3>
                <p className="text-sm text-muted-foreground">
                  Once you delete your account, there is no going back. Please
                  be certain.
                </p>
                <Button variant="destructive" disabled>
                  Delete Account
                </Button>
                <p className="text-xs text-muted-foreground">
                  Account deletion is not self-serve yet. Contact support.
                </p>
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
                Manage your password and security settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
                  Enter your current password (for Firebase security verification).
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPass">New Password</Label>
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
                  Use at least 8 characters.
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
                Update Password
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
