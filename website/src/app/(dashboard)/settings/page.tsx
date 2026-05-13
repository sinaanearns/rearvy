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
  Wallet,
  RefreshCcw,
  UserCog,
  Trash2,
  Settings2,
  Terminal,
} from "lucide-react";
import { isElectron } from "@/lib/utils/env";
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

type EthereumRequestArgs = {
  method: string;
  params?: unknown[] | Record<string, unknown>;
};

type EthereumProvider = {
  isMetaMask?: boolean;
  request: (args: EthereumRequestArgs) => Promise<unknown>;
  on?: (
    eventName: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void
  ) => void;
  removeListener?: (
    eventName: "accountsChanged" | "chainChanged",
    listener: (...args: unknown[]) => void
  ) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

const KNOWN_NETWORKS: Record<string, string> = {
  "0x1": "Ethereum Mainnet",
  "0x5": "Goerli",
  "0xaa36a7": "Sepolia",
  "0x89": "Polygon",
  "0xa": "Optimism",
  "0xa4b1": "Arbitrum",
  "0x2105": "Base",
};

function normalizeNumberish(value: unknown, fallback: number | null = null) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

function formatEth(value: number | null) {
  if (value === null) return "-";
  return `${value.toFixed(6)} ETH`;
}

function formatEur(value: number | null) {
  if (value === null) return "-";
  return new Intl.NumberFormat("en-IE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 2,
  }).format(value);
}

function getNetworkName(chainId: string) {
  if (!chainId) return "Unknown";
  return KNOWN_NETWORKS[chainId.toLowerCase()] || chainId;
}

async function fetchEthPriceInEur() {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=eur"
  );
  if (!response.ok) {
    throw new Error("Unable to fetch ETH to EUR price.");
  }

  const payload = (await response.json()) as {
    ethereum?: { eur?: number };
  };

  const eur = payload.ethereum?.eur;
  if (typeof eur !== "number" || !Number.isFinite(eur) || eur <= 0) {
    throw new Error("Invalid ETH to EUR price response.");
  }

  return eur;
}

async function getWalletSnapshot(provider: EthereumProvider, requestedAddress?: string) {
  let address = requestedAddress?.trim() || "";
  if (!address) {
    const accounts = (await provider.request({
      method: "eth_accounts",
    })) as unknown;

    if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== "string") {
      return null;
    }

    address = accounts[0];
  }

  const [balanceHex, chainId, ethPriceEur] = await Promise.all([
    provider.request({ method: "eth_getBalance", params: [address, "latest"] }),
    provider.request({ method: "eth_chainId" }),
    fetchEthPriceInEur(),
  ]);

  if (typeof balanceHex !== "string" || typeof chainId !== "string") {
    throw new Error("Unexpected wallet data response from MetaMask.");
  }

  const wei = BigInt(balanceHex);
  const ethBalance = Number(wei) / 1e18;
  const eurBalance = ethBalance * ethPriceEur;

  return {
    address,
    chainId,
    networkName: getNetworkName(chainId),
    ethBalance,
    eurBalance,
  };
}

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
    metamask_address: "",
    metamask_chain_id: "",
    metamask_network: "",
    metamask_eth_balance: null as number | null,
    metamask_eur_balance: null as number | null,
    metamask_last_synced_at: "",
    execution_budget_eur: 0,
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
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [refreshingWallet, setRefreshingWallet] = useState(false);
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
          metamask_address: data.profile.metamask_address || "",
          metamask_chain_id: data.profile.metamask_chain_id || "",
          metamask_network: data.profile.metamask_network || "",
          metamask_eth_balance: normalizeNumberish(data.profile.metamask_eth_balance),
          metamask_eur_balance: normalizeNumberish(data.profile.metamask_eur_balance),
          metamask_last_synced_at: data.profile.metamask_last_synced_at || "",
          execution_budget_eur: Math.max(
            0,
            normalizeNumberish(data.profile.execution_budget_eur, 0) ?? 0
          ),
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

  async function refreshMetaMaskWallet(options?: { requestedAddress?: string }) {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("MetaMask is not installed in this browser.");
      return;
    }

    setRefreshingWallet(true);
    try {
      const snapshot = await getWalletSnapshot(window.ethereum, options?.requestedAddress);

      if (!snapshot) {
        setProfile((prev) => ({
          ...prev,
          metamask_address: "",
          metamask_chain_id: "",
          metamask_network: "",
          metamask_eth_balance: null,
          metamask_eur_balance: null,
          metamask_last_synced_at: "",
        }));
        toast.message("No MetaMask account is connected right now.");
        return;
      }

      setProfile((prev) => ({
        ...prev,
        metamask_address: snapshot.address,
        metamask_chain_id: snapshot.chainId,
        metamask_network: snapshot.networkName,
        metamask_eth_balance: snapshot.ethBalance,
        metamask_eur_balance: snapshot.eurBalance,
        metamask_last_synced_at: new Date().toISOString(),
      }));
      toast.success("MetaMask wallet data refreshed.");
    } catch (error) {
      console.error("Error refreshing MetaMask wallet:", error);
      toast.error(error instanceof Error ? error.message : "Failed to refresh wallet.");
    } finally {
      setRefreshingWallet(false);
    }
  }

  async function handleConnectMetaMask() {
    if (typeof window === "undefined" || !window.ethereum) {
      toast.error("MetaMask is not installed. Please install the extension first.");
      return;
    }

    setConnectingWallet(true);
    try {
      const accounts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as unknown;

      if (!Array.isArray(accounts) || accounts.length === 0 || typeof accounts[0] !== "string") {
        throw new Error("No wallet account was returned by MetaMask.");
      }

      await refreshMetaMaskWallet({ requestedAddress: accounts[0] });
      toast.success("MetaMask connected. Save settings to store this wallet.");
    } catch (error) {
      console.error("Error connecting MetaMask:", error);
      toast.error(error instanceof Error ? error.message : "Failed to connect MetaMask.");
    } finally {
      setConnectingWallet(false);
    }
  }

  function disconnectMetaMaskWallet() {
    setProfile((prev) => ({
      ...prev,
      metamask_address: "",
      metamask_chain_id: "",
      metamask_network: "",
      metamask_eth_balance: null,
      metamask_eur_balance: null,
      metamask_last_synced_at: "",
      execution_budget_eur: 0,
    }));
    toast.message("Wallet data cleared. Save settings to persist this change.");
  }

  useEffect(() => {
    if (typeof window === "undefined" || !window.ethereum) {
      return;
    }

    const provider = window.ethereum;
    const handleAccountsChanged = (...args: unknown[]) => {
      const firstArg = args[0];
      const firstAccount =
        Array.isArray(firstArg) && typeof firstArg[0] === "string"
          ? firstArg[0]
          : undefined;
      void refreshMetaMaskWallet({ requestedAddress: firstAccount });
    };

    const handleChainChanged = () => {
      void refreshMetaMaskWallet();
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

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
          metamask_address: profile.metamask_address || null,
          metamask_chain_id: profile.metamask_chain_id || null,
          metamask_network: profile.metamask_network || null,
          metamask_eth_balance: profile.metamask_eth_balance,
          metamask_eur_balance: profile.metamask_eur_balance,
          metamask_last_synced_at: profile.metamask_last_synced_at || null,
          execution_budget_eur: Math.max(
            0,
            normalizeNumberish(profile.execution_budget_eur, 0) ?? 0
          ),
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
          <TabsTrigger
            value="account"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
          >
            <UserCog className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          {isElectron() && (
            <TabsTrigger
              value="advanced"
              className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent px-2 py-3 shadow-none transition-none"
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Advanced
            </TabsTrigger>
          )}
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
                <CardTitle className="flex items-center gap-2">
                  <Wallet className="h-5 w-5" />
                  MetaMask Wallet for AI Execution
                </CardTitle>
                <CardDescription>
                  Connect MetaMask, see your ETH value in EUR, and set how much EUR is available for Rearvy AI execution.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleConnectMetaMask}
                    disabled={connectingWallet}
                  >
                    {connectingWallet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {profile.metamask_address ? "Reconnect MetaMask" : "Connect MetaMask"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void refreshMetaMaskWallet()}
                    disabled={refreshingWallet || !profile.metamask_address}
                  >
                    {refreshingWallet ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <RefreshCcw className="mr-2 h-4 w-4" />
                    )}
                    Refresh Balance
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={disconnectMetaMaskWallet}
                    disabled={!profile.metamask_address}
                  >
                    Clear Wallet
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-1 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Wallet address</p>
                    <p className="break-all text-sm font-medium">
                      {profile.metamask_address || "Not connected"}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Network</p>
                    <p className="text-sm font-medium">
                      {profile.metamask_network || "Unknown"}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">ETH balance</p>
                    <p className="text-sm font-medium">
                      {formatEth(profile.metamask_eth_balance)}
                    </p>
                  </div>
                  <div className="space-y-1 rounded-lg border bg-background p-3">
                    <p className="text-xs text-muted-foreground">Estimated EUR value</p>
                    <p className="text-sm font-medium">
                      {formatEur(profile.metamask_eur_balance)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="executionBudget">Execution Budget (EUR)</Label>
                    <Input
                      id="executionBudget"
                      type="number"
                      min="0"
                      step="0.01"
                      value={profile.execution_budget_eur}
                      onChange={(e) => {
                        const nextValue = Number.parseFloat(e.target.value);
                        setProfile((prev) => ({
                          ...prev,
                          execution_budget_eur: Number.isFinite(nextValue) && nextValue > 0
                            ? nextValue
                            : 0,
                        }));
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Set the max EUR amount Rearvy AI can use for execution flows.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Available for execution</Label>
                    <div className="rounded-lg border bg-background p-3">
                      <p className="text-sm font-semibold">
                        {formatEur(
                          profile.metamask_eur_balance === null
                            ? null
                            : Math.min(
                                profile.execution_budget_eur,
                                profile.metamask_eur_balance
                              )
                        )}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Uses the lower value between your budget and current wallet EUR estimate.
                      </p>
                    </div>
                    <p className="text-[10px] text-muted-foreground italic">
                      Last synced: {profile.metamask_last_synced_at
                        ? new Date(profile.metamask_last_synced_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
              <CardHeader>
                <CardTitle>Plan</CardTitle>
                <CardDescription>
                  All features are free to use.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-2xl border border-primary bg-background shadow-sm p-5">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">Free access</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Agency AI workspace for connected client data
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 outline-none">
          <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
            <CardHeader>
              <CardTitle>Account Overview</CardTitle>
              <CardDescription>
                Core account settings and ownership details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountEmail">Account Email</Label>
                <Input
                  id="accountEmail"
                  value={email}
                  disabled
                  className="bg-muted/50 cursor-not-allowed shadow-none"
                />
              </div>
              <div className="rounded-lg border bg-background p-4">
                <p className="text-sm font-medium">Profile and business preferences</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Profile details, business info, wallet config, and plan settings are managed in the Profile tab.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card className="border border-destructive/30 bg-destructive/5 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>
                Irreversible account actions are separated here for safety.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-destructive/30 bg-background p-4">
                <p className="text-sm font-medium text-destructive">Delete all my data</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Permanently remove your account data, integrations, profile, and chat history.
                </p>
                <Button asChild variant="destructive" className="mt-3">
                  <Link href="/data-delete">Open data deletion</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {isElectron() && (
          <TabsContent value="advanced" className="space-y-6 outline-none">
            <Card className="border-none bg-accent/5 shadow-none dark:bg-accent/10">
              <CardHeader>
                <CardTitle>Desktop Diagnostics</CardTitle>
                <CardDescription>
                  Advanced tools for troubleshooting the Rearvy Desktop environment.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background-muted/40 p-4">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-blue-500/10 p-2">
                        <Terminal className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold">App Console (DevTools)</p>
                        <p className="text-xs text-muted-foreground">
                          Open the integrated developer tools to view system logs, network activity, and troubleshoot issues.
                        </p>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={async () => {
                          if (window.electron?.system?.openDevTools) {
                            await window.electron.system.openDevTools();
                            toast.success("Developer Console opened");
                          } else {
                            toast.error("Desktop bridge not found");
                          }
                        }}
                      >
                        Open Console
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 rounded-xl border border-border/70 bg-background-muted/40 p-4 opacity-70">
                    <div className="flex items-start gap-4">
                      <div className="rounded-lg bg-emerald-500/10 p-2">
                        <RefreshCcw className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-sm font-semibold">Force App Reload</p>
                        <p className="text-xs text-muted-foreground">
                          Clear the current session and reload the desktop interface.
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => window.location.reload()}
                      >
                        Reload
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
