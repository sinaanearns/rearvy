"use client";

import { useState, useEffect, type ReactNode } from "react";
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
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
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
  type LucideIcon,
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
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import { DEFAULT_PLAN, FREE_PLAN_CREDITS_LABEL, REARVY_PLANS, type SubscriptionPlan } from "@/lib/plans";
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

const settingsTabTriggerClass =
  "min-h-11 rounded-[8px] border border-transparent bg-background/70 px-3 py-2 text-sm font-semibold text-muted-foreground shadow-sm shadow-slate-950/[0.02] transition hover:border-border hover:bg-background data-[state=active]:border-slate-950 data-[state=active]:bg-slate-950 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-slate-950/15 dark:bg-white/[0.04] dark:data-[state=active]:border-cyan-200/35 dark:data-[state=active]:bg-cyan-200/12 dark:data-[state=active]:text-cyan-50";

const settingsProfileCardClass =
  "overflow-hidden rounded-[8px] border border-border/70 bg-card/90 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-slate-950/72";

const settingsProfileHeaderClass =
  "border-b border-border/60 bg-muted/20 dark:border-white/10 dark:bg-white/[0.035]";

const settingsProfileTileClass =
  "rounded-[8px] border border-border/70 bg-background/72 p-3 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]";

const log = createClientLogger("SettingsPage");

type SettingsPanelTone = "emerald" | "amber" | "rose" | "blue" | "slate";

const settingsPanelToneStyles: Record<
  SettingsPanelTone,
  { wash: string; edge: string; icon: string }
> = {
  emerald: {
    wash:
      "bg-[linear-gradient(115deg,rgba(45,212,191,0.1),transparent_34%),linear-gradient(248deg,rgba(52,211,153,0.1),transparent_42%)]",
    edge: "via-emerald-300/45 dark:via-emerald-200/24",
    icon: "border-emerald-200/40 bg-emerald-200/10 text-emerald-600 dark:text-emerald-100",
  },
  amber: {
    wash:
      "bg-[linear-gradient(115deg,rgba(247,201,72,0.12),transparent_34%),linear-gradient(248deg,rgba(105,215,255,0.08),transparent_42%)]",
    edge: "via-amber-300/48 dark:via-amber-200/24",
    icon: "border-amber-200/45 bg-amber-200/12 text-amber-600 dark:text-amber-100",
  },
  rose: {
    wash:
      "bg-[linear-gradient(115deg,rgba(244,63,94,0.1),transparent_34%),linear-gradient(248deg,rgba(247,201,72,0.08),transparent_42%)]",
    edge: "via-rose-300/42 dark:via-rose-200/24",
    icon: "border-rose-200/45 bg-rose-200/12 text-rose-600 dark:text-rose-100",
  },
  blue: {
    wash:
      "bg-[linear-gradient(115deg,rgba(59,130,246,0.11),transparent_34%),linear-gradient(248deg,rgba(45,212,191,0.08),transparent_42%)]",
    edge: "via-blue-300/42 dark:via-blue-200/24",
    icon: "border-blue-200/45 bg-blue-200/12 text-blue-600 dark:text-blue-100",
  },
  slate: {
    wash:
      "bg-[linear-gradient(115deg,rgba(148,163,184,0.1),transparent_34%),linear-gradient(248deg,rgba(105,215,255,0.08),transparent_42%)]",
    edge: "via-slate-300/42 dark:via-slate-200/22",
    icon: "border-slate-200/50 bg-slate-200/14 text-slate-700 dark:text-slate-100",
  },
};

function SettingsPanel({
  icon: Icon,
  eyebrow,
  title,
  description,
  tone = "emerald",
  children,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: ReactNode;
  tone?: SettingsPanelTone;
  children: ReactNode;
}) {
  const styles = settingsPanelToneStyles[tone];

  return (
    <section className="relative overflow-hidden rounded-[8px] border border-border/70 bg-card/90 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-slate-950/72">
      <div aria-hidden className={cn("pointer-events-none absolute inset-0", styles.wash)} />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          styles.edge
        )}
      />
      <div className="relative grid gap-6 p-5 sm:p-6 lg:grid-cols-[0.42fr_0.58fr]">
        <header className="min-w-0">
          <div className={cn("flex h-11 w-11 items-center justify-center rounded-[8px] border", styles.icon)}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="mt-5 text-xs font-medium text-muted-foreground">
            {eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">
            {title}
          </h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </header>

        <div className="min-w-0">{children}</div>
      </div>
    </section>
  );
}

function SettingsInfoTile({
  icon: Icon,
  label,
  value,
  tone = "slate",
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  tone?: SettingsPanelTone;
}) {
  const styles = settingsPanelToneStyles[tone];

  return (
    <div className="grid min-h-20 grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-border/70 bg-background/72 p-3 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
      <span className={cn("flex h-9 w-9 items-center justify-center rounded-[8px] border", styles.icon)}>
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-muted-foreground">{label}</span>
        <span className="mt-1 block break-words text-sm font-semibold text-foreground">{value}</span>
      </span>
    </div>
  );
}

const defaultProfile = {
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
};

type SettingsProfile = typeof defaultProfile;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    .map((item) => item.trim())
    .slice(0, 20);
}

function isSubscriptionPlan(value: unknown): value is SubscriptionPlan {
  return value === "free" || value === "pro" || value === "business";
}

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

function getSettingsProfile(value: unknown): SettingsProfile {
  if (!isRecord(value)) {
    return { ...defaultProfile, skills: [], project_links: [] };
  }

  return {
    full_name: normalizeRearvyDisplayText(value.full_name) ?? "",
    username: getString(value.username),
    bio: getString(value.bio),
    working_on: getString(value.working_on),
    skills: getStringArray(value.skills),
    project_links: getStringArray(value.project_links),
    business_name: normalizeRearvyDisplayText(value.business_name) ?? "",
    business_type: getString(value.business_type),
    timezone: getString(value.timezone, "UTC") || "UTC",
    currency: getString(value.currency, "USD") || "USD",
    plan: isSubscriptionPlan(value.plan) ? value.plan : DEFAULT_PLAN,
    avatar_url: getString(value.avatar_url),
    metamask_address: getString(value.metamask_address),
    metamask_chain_id: getString(value.metamask_chain_id),
    metamask_network: getString(value.metamask_network),
    metamask_eth_balance: normalizeNumberish(value.metamask_eth_balance),
    metamask_eur_balance: normalizeNumberish(value.metamask_eur_balance),
    metamask_last_synced_at: getString(value.metamask_last_synced_at),
    execution_budget_eur: Math.max(
      0,
      normalizeNumberish(value.execution_budget_eur, 0) ?? 0
    ),
  };
}

async function readProfileResponse(response: Response): Promise<SettingsProfile> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return getSettingsProfile(null);
  }

  return getSettingsProfile(payload.profile);
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

async function readRedeemResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return { plan: null as SubscriptionPlan | null };
  }

  return {
    plan: isSubscriptionPlan(payload.plan) ? payload.plan : null,
  };
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

function isMetaMaskUserRejectedError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const metaMaskError = error as {
    code?: unknown;
    message?: unknown;
    data?: { cause?: unknown };
  };

  return (
    metaMaskError.code === 4001 ||
    metaMaskError.data?.cause === "rejectAllApprovals" ||
    (typeof metaMaskError.message === "string" &&
      metaMaskError.message.toLowerCase().includes("user rejected the request"))
  );
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

  const payload = (await response.json().catch(() => null)) as unknown;
  const ethereum = isRecord(payload) && isRecord(payload.ethereum) ? payload.ethereum : null;

  const eur = ethereum?.eur;
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
  const [profile, setProfile] = useState<SettingsProfile>(() => ({
    ...defaultProfile,
    skills: [],
    project_links: [],
  }));
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
  const [redeemCode, setRedeemCode] = useState("");
  const [redeemingCode, setRedeemingCode] = useState(false);
  const { theme, setTheme } = useTheme();
  const hasPasswordProvider = Boolean(
    user?.providerData.some((provider) => provider.providerId === "password")
  );
  const hasGoogleProvider = Boolean(
    user?.providerData.some((provider) => provider.providerId === "google.com")
  );
  const activePlanLabel =
    profile.plan === "business" ? "Paid access" : profile.plan === "pro" ? "Pro" : "Free";
  const authProviderLabel = [
    hasGoogleProvider ? "Google" : null,
    hasPasswordProvider ? "Password" : null,
  ]
    .filter(Boolean)
    .join(" + ") || "Provider pending";
  const displayProfileName =
    normalizeRearvyDisplayText(profile.full_name) || profile.username || "Needs details";
  const avatarFallbackName =
    normalizeRearvyDisplayText(profile.full_name) || profile.username || "Rearvy";
  const settingsHighlights = [
    {
      label: "Profile",
      value: displayProfileName,
      helper: email || "Account email pending",
      icon: User,
    },
    {
      label: "Plan",
      value: activePlanLabel,
      helper: `${FREE_PLAN_CREDITS_LABEL} on free access`,
      icon: Coins,
    },
    {
      label: "Security",
      value: authProviderLabel,
      helper: profile.metamask_address ? "Wallet option saved" : "Wallet option not set",
      icon: ShieldCheck,
    },
  ];

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

        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to fetch profile"));
        }

        const profile = await readProfileResponse(response);
        setProfile(profile);
        setSkillsInput(profile.skills.join(", "));
        setProjectLinksInput(profile.project_links.join("\n"));
      } catch (error) {
        log.error("Error loading profile:", error);
        toast.error(getErrorMessage(error, "Failed to load profile"));
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
      log.error("Error refreshing MetaMask wallet:", error);
      toast.error(getErrorMessage(error, "Failed to refresh wallet."));
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
      toast.success("MetaMask connected. Save settings to keep this transaction option.");
    } catch (error) {
      if (isMetaMaskUserRejectedError(error)) {
        toast.message("MetaMask connection canceled.");
        return;
      }

      log.error("Error connecting MetaMask:", error);
      toast.error(getErrorMessage(error, "Failed to connect MetaMask."));
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
    toast.message("MetaMask transaction option cleared. Save settings to persist this change.");
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

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Failed to save profile"));
      }
      toast.success("Profile updated successfully");
    } catch (error) {
      log.error("Error saving profile:", error);
      toast.error(getErrorMessage(error, "Failed to save changes"));
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
      log.error("Error updating password:", error);
      toast.error(getErrorMessage(error, "Failed to update password"));
    } finally {
      setUpdatingPassword(false);
    }
  }

  async function handleRedeemCode() {
    if (!user) return;

    const code = redeemCode.trim();
    if (!code) {
      toast.error("Enter a redeem code.");
      return;
    }

    setRedeemingCode(true);
    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/billing/redeem-code", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ code }),
      });

      if (!response.ok) {
        throw new Error(await readErrorMessage(response, "Redeem code could not be applied."));
      }

      const payload = await readRedeemResponse(response);
      const activatedPlan = payload.plan === "business" ? "business" : "pro";
      setRedeemCode("");
      setProfile((prev) => ({ ...prev, plan: activatedPlan }));
      toast.success(
        `Redeem code applied. ${activatedPlan === "business" ? "Paid access" : "Pro"} is active.`
      );
    } catch (error) {
      log.error("Redeem code failed:", error);
      toast.error(getErrorMessage(error, "Redeem code failed."));
    } finally {
      setRedeemingCode(false);
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
    <div className="mx-auto max-w-6xl space-y-8 pb-10">
      <DashboardPageHero
        eyebrow="Account controls"
        title="Settings"
        description="Tune profile details, access, billing, security, and desktop preferences from one account surface."
        icon={Settings2}
        accent="emerald"
        metrics={settingsHighlights.map((item) => ({
          label: item.label,
          value: item.value,
          detail: item.helper,
          icon: item.icon,
        }))}
      />

      <Tabs defaultValue="profile" className="w-full space-y-6">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-2 rounded-[8px] border border-border/70 bg-muted/30 p-2 shadow-sm shadow-slate-950/[0.03] sm:grid-cols-3 lg:grid-cols-6">
          <TabsTrigger
            value="profile"
            className={settingsTabTriggerClass}
          >
            <User className="mr-2 h-4 w-4" />
            Profile
          </TabsTrigger>
          <TabsTrigger
            value="appearance"
            className={settingsTabTriggerClass}
          >
            <Palette className="mr-2 h-4 w-4" />
            Appearance
          </TabsTrigger>
          <TabsTrigger
            value="notifications"
            className={settingsTabTriggerClass}
          >
            <Bell className="mr-2 h-4 w-4" />
            Notifications
          </TabsTrigger>
          <TabsTrigger
            value="security"
            className={settingsTabTriggerClass}
          >
            <ShieldCheck className="mr-2 h-4 w-4" />
            Security
          </TabsTrigger>
          <TabsTrigger
            value="account"
            className={settingsTabTriggerClass}
          >
            <UserCog className="mr-2 h-4 w-4" />
            Account
          </TabsTrigger>
          {isElectron() && (
            <TabsTrigger
              value="advanced"
              className={settingsTabTriggerClass}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Advanced
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="profile" className="space-y-6 outline-none">
          <form onSubmit={handleSave} className="space-y-6">
            <Card className={settingsProfileCardClass}>
              <CardHeader className={settingsProfileHeaderClass}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-emerald-200/40 bg-emerald-200/10 text-emerald-600 dark:text-emerald-100">
                    <User className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>
                      This information will be displayed on your profile.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-5 sm:p-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Profile Photo</Label>
                    <div className={cn(settingsProfileTileClass, "flex flex-col gap-4 sm:flex-row sm:items-center")}>
                      <Avatar size="lg" className="h-20 w-20 rounded-[8px] border border-emerald-200/35 shadow-sm shadow-slate-950/[0.04]">
                        <AvatarImage src={profile.avatar_url || undefined} alt="Profile photo" />
                        <AvatarFallback className="rounded-[8px] bg-emerald-200/10 text-base font-semibold text-emerald-700 dark:text-emerald-100">
                          {getNameInitials(avatarFallbackName)}
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
                          <label className="inline-flex cursor-pointer items-center gap-2 rounded-[8px] border border-input bg-background px-3 py-2 text-sm font-medium shadow-sm shadow-slate-950/[0.02] hover:bg-accent">
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
                        <p className="text-[10px] text-muted-foreground">
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
                    <Label htmlFor="bio">Tell me about you</Label>
                    <Textarea
                      id="bio"
                      placeholder="Write a short intro about yourself."
                      value={profile.bio}
                      onChange={(e) => setProfile({ ...profile, bio: e.target.value })}
                      className="min-h-24 bg-background-muted shadow-none"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="workingOn">What are you working on?</Label>
                    <Textarea
                      id="workingOn"
                      placeholder="Share what you are building or focused on."
                      value={profile.working_on}
                      onChange={(e) =>
                        setProfile({ ...profile, working_on: e.target.value })
                      }
                      className="min-h-20 bg-background-muted shadow-none"
                    />
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="skills">What are you good at?</Label>
                    <Input
                      id="skills"
                      placeholder="Design, coding, marketing"
                      value={skillsInput}
                      onChange={(e) => setSkillsInput(e.target.value)}
                      className="bg-background-muted shadow-none"
                    />
                    <p className="text-[10px] text-muted-foreground italic">
                      Separate skills with commas.
                    </p>
                  </div>

                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="projectLinks">Links</Label>
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

            <Card className={settingsProfileCardClass}>
              <CardHeader className={settingsProfileHeaderClass}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/40 bg-cyan-200/10 text-cyan-600 dark:text-cyan-100">
                    <Building2 className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Business Details</CardTitle>
                    <CardDescription>
                      Information about your business or brand.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 p-5 sm:p-6">
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

            <Card className={settingsProfileCardClass}>
              <CardHeader className={settingsProfileHeaderClass}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-amber-200/45 bg-amber-200/12 text-amber-600 dark:text-amber-100">
                    <Wallet className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>MetaMask Transaction Option</CardTitle>
                    <CardDescription>
                      Optional wallet setup for transaction workflows. Rearvy does not need it for normal AI assistance and can use it only after you approve a transaction draft.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    onClick={handleConnectMetaMask}
                    disabled={connectingWallet}
                  >
                    {connectingWallet && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {profile.metamask_address ? "Update MetaMask" : "Set up MetaMask"}
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
                    Clear Option
                  </Button>
                </div>

                <div className="rounded-[8px] border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
                  MetaMask is saved for wallet reference only. AI transaction drafts and wallet submission are disabled while there is no approval console.
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className={settingsProfileTileClass}>
                    <p className="text-xs text-muted-foreground">Wallet address</p>
                    <p className="break-all text-sm font-medium">
                      {profile.metamask_address || "Not connected"}
                    </p>
                  </div>
                  <div className={settingsProfileTileClass}>
                    <p className="text-xs text-muted-foreground">Network</p>
                    <p className="text-sm font-medium">
                      {profile.metamask_network || "Unknown"}
                    </p>
                  </div>
                  <div className={settingsProfileTileClass}>
                    <p className="text-xs text-muted-foreground">ETH balance</p>
                    <p className="text-sm font-medium">
                      {formatEth(profile.metamask_eth_balance)}
                    </p>
                  </div>
                  <div className={settingsProfileTileClass}>
                    <p className="text-xs text-muted-foreground">Estimated EUR value</p>
                    <p className="text-sm font-medium">
                      {formatEur(profile.metamask_eur_balance)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="transactionLimit">Optional Transaction Limit (EUR)</Label>
                    <Input
                      id="transactionLimit"
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
                      Used only as a user-defined cap for approved transaction flows.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Available for approved transactions</Label>
                    <div className={settingsProfileTileClass}>
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
                        The lower value between your transaction limit and current wallet EUR estimate.
                      </p>
                    </div>
                    <p className="text-[10px] italic text-muted-foreground">
                      Last synced: {profile.metamask_last_synced_at
                        ? new Date(profile.metamask_last_synced_at).toLocaleString()
                        : "Never"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card id="plan" className={cn(settingsProfileCardClass, "scroll-mt-24")}>
              <CardHeader className={settingsProfileHeaderClass}>
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-emerald-200/40 bg-emerald-200/10 text-emerald-600 dark:text-emerald-100">
                    <Coins className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <CardTitle>Plan</CardTitle>
                    <CardDescription>
                      Free users receive {FREE_PLAN_CREDITS_LABEL}.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4 p-5 sm:p-6">
                <div className="relative overflow-hidden rounded-[8px] border border-emerald-200/55 bg-background/82 p-5 shadow-sm shadow-slate-950/[0.03] dark:border-emerald-200/22 dark:bg-white/[0.04]">
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,rgba(52,211,153,0.1),transparent_44%)]"
                  />
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div className="relative">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-semibold">Free access</span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Agency AI workspace for connected client data
                      </p>
                    </div>
                    <div className="relative text-right">
                      <div className="text-2xl font-bold">$0</div>
                      <div className="text-xs text-muted-foreground">/month</div>
                    </div>
                  </div>

                  <div className="relative space-y-2">
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

                <div className={cn(settingsProfileTileClass, "p-5")}>
                  <Label htmlFor="redeemCode">Redeem code</Label>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      id="redeemCode"
                      value={redeemCode}
                      onChange={(event) => setRedeemCode(event.target.value)}
                      placeholder="Enter your code"
                      className="bg-background-muted shadow-none"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void handleRedeemCode()}
                      disabled={redeemingCode || !redeemCode.trim()}
                    >
                      {redeemingCode && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Redeem
                    </Button>
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
          <SettingsPanel
            icon={Palette}
            eyebrow="Display"
            title="Choose the workspace theme"
            description="Keep Rearvy aligned with your device and the way you prefer to review long-running work."
            tone="amber"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  value: "light",
                  label: "Light",
                  detail: "Bright review surface",
                  icon: Sun,
                  previewClass: "border-slate-200 bg-white",
                  iconClass: "text-amber-500",
                },
                {
                  value: "dark",
                  label: "Dark",
                  detail: "Low-glare workspace",
                  icon: Moon,
                  previewClass: "border-slate-700 bg-slate-950",
                  iconClass: "text-blue-300",
                },
                {
                  value: "system",
                  label: "System",
                  detail: "Match this device",
                  icon: Monitor,
                  previewClass: "border-slate-300 bg-[linear-gradient(90deg,#fff_0_50%,#020617_50%)]",
                  iconClass: "text-slate-500",
                },
              ].map((option) => {
                const Icon = option.icon;
                const isActive = theme === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    className={cn(
                      "group min-w-0 rounded-[8px] border border-border/70 bg-background/72 p-3 text-left shadow-sm shadow-slate-950/[0.02] transition hover:border-amber-300/60 hover:bg-background dark:border-white/10 dark:bg-white/[0.04] dark:hover:border-amber-200/30",
                      isActive &&
                        "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:border-amber-200/35 dark:bg-amber-200/10"
                    )}
                    aria-pressed={isActive}
                  >
                    <span
                      className={cn(
                        "flex h-16 items-center justify-center rounded-[8px] border transition-transform group-hover:-translate-y-0.5",
                        option.previewClass
                      )}
                    >
                      <Icon className={cn("h-6 w-6", option.iconClass)} aria-hidden="true" />
                    </span>
                    <span className="mt-3 block text-sm font-semibold">{option.label}</span>
                    <span
                      className={cn(
                        "mt-1 block text-xs text-muted-foreground",
                        isActive && "text-white/66 dark:text-amber-50/72"
                      )}
                    >
                      {option.detail}
                    </span>
                  </button>
                );
              })}
            </div>
          </SettingsPanel>
        </TabsContent>


        <TabsContent value="notifications" className="space-y-6 outline-none">
          <SettingsPanel
            icon={Bell}
            eyebrow="Signals"
            title="Critical alerts stay on"
            description="Rearvy keeps important integration and workflow alerts enabled while granular channel preferences are still being built."
            tone="blue"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <SettingsInfoTile
                icon={ShieldCheck}
                label="Critical integration alerts"
                value="Enabled by default"
                tone="emerald"
              />
              <SettingsInfoTile
                icon={Bell}
                label="Granular preferences"
                value="Coming later"
                tone="blue"
              />
            </div>
            <div className="mt-4 rounded-[8px] border border-border/70 bg-background/72 p-4 text-sm leading-6 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]">
              Alerts that protect connected work, failed syncs, and important approval moments remain visible so account operations do not silently fail.
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="security" className="space-y-6 outline-none">
          <SettingsPanel
            icon={ShieldCheck}
            eyebrow="Access"
            title={hasPasswordProvider ? "Manage password access" : "Add password login"}
            description={
              hasPasswordProvider
                ? "Update the password attached to this account without changing existing provider access."
                : "Create a password so this account can sign in with email and password as well as connected providers."
            }
            tone="emerald"
          >
            <div className="space-y-4 rounded-[8px] border border-border/70 bg-background/72 p-4 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
              <div className="grid gap-3 sm:grid-cols-2">
                <SettingsInfoTile
                  icon={ShieldCheck}
                  label="Current providers"
                  value={authProviderLabel}
                  tone="emerald"
                />
                <SettingsInfoTile
                  icon={UserCog}
                  label="Account email"
                  value={email || "Email pending"}
                  tone="slate"
                />
              </div>

              {hasPasswordProvider && (
                <div className="space-y-2">
                  <Label htmlFor="currentPass">Current Password</Label>
                  <Input
                    id="currentPass"
                    type="password"
                    value={passwordForm.current}
                    className="bg-background-muted shadow-none"
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
                  className="bg-background-muted shadow-none"
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
            </div>
          </SettingsPanel>
        </TabsContent>

        <TabsContent value="account" className="space-y-6 outline-none">
          <SettingsPanel
            icon={UserCog}
            eyebrow="Ownership"
            title="Account overview"
            description="Core account identity, profile ownership, and irreversible account actions stay separated for safer changes."
            tone="slate"
          >
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountEmail">Account Email</Label>
                <Input
                  id="accountEmail"
                  value={email}
                  disabled
                  className="bg-muted/50 cursor-not-allowed shadow-none"
                />
              </div>
              <div className="rounded-[8px] border border-border/70 bg-background/72 p-4 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-slate-200/70 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/[0.06] dark:text-slate-100">
                    <User className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Profile and business preferences</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Profile details, business info, automation safety, optional transaction settings, and plan settings are managed in the Profile tab.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SettingsPanel>

          <SettingsPanel
            icon={Trash2}
            eyebrow="Danger zone"
            title="Delete account data"
            description="Permanent deletion is intentionally routed to a dedicated confirmation page with explicit typed consent."
            tone="rose"
          >
            <div className="rounded-[8px] border border-destructive/30 bg-destructive/5 p-4 shadow-sm shadow-slate-950/[0.02]">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-destructive">Delete all my data</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Permanently remove your account data, integrations, profile, and chat history.
                  </p>
                </div>
                <Button asChild variant="destructive" className="shrink-0">
                  <Link href="/data-delete">Open data deletion</Link>
                </Button>
              </div>
            </div>
          </SettingsPanel>
        </TabsContent>

        {isElectron() && (
          <TabsContent value="advanced" className="space-y-6 outline-none">
            <SettingsPanel
              icon={Terminal}
              eyebrow="Desktop"
              title="Desktop diagnostics"
              description="Advanced controls for inspecting the Electron bridge and recovering the desktop interface."
              tone="blue"
            >
              <div className="space-y-3">
                <div className="rounded-[8px] border border-border/70 bg-background/72 p-4 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.04]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-blue-200/50 bg-blue-200/12 text-blue-600 dark:border-blue-200/25 dark:text-blue-100">
                        <Terminal className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">App Console</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Open integrated developer tools to inspect logs, network activity, and bridge state.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0"
                      onClick={async () => {
                        try {
                          if (process.env.NODE_ENV !== "production") {
                            console.debug("[Settings] Opening DevTools, bridge state:", {
                              hasElectron: !!window.electron,
                              hasSystem: !!window.electron?.system,
                              hasOpenDevTools: typeof window.electron?.system?.openDevTools,
                              allKeys: Object.keys(window.electron || {}),
                              systemKeys: Object.keys(window.electron?.system || {}),
                            });
                          }

                          if (!window.electron) {
                            toast.error("App not running in Electron environment");
                            return;
                          }
                          if (!window.electron.system) {
                            toast.error("Desktop system bridge not initialized");
                            return;
                          }
                          if (typeof window.electron.system.openDevTools !== "function") {
                            toast.error(`Developer tools API not available (type: ${typeof window.electron.system.openDevTools})`);
                            return;
                          }

                          await window.electron.system.openDevTools();
                          toast.success("Developer Console opened");
                        } catch (error) {
                          log.error("[DevTools] Error opening console:", error);
                          toast.error(`Failed to open console: ${getErrorMessage(error, "Unknown error")}`);
                        }
                      }}
                    >
                      Open Console
                    </Button>
                  </div>
                </div>

                <div className="rounded-[8px] border border-border/70 bg-background/60 p-4 opacity-75 shadow-sm shadow-slate-950/[0.02] dark:border-white/10 dark:bg-white/[0.035]">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-emerald-200/50 bg-emerald-200/12 text-emerald-600 dark:border-emerald-200/25 dark:text-emerald-100">
                        <RefreshCcw className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">Force app reload</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Clear the current render state and reload the desktop interface.
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={() => window.location.reload()}
                    >
                      Reload
                    </Button>
                  </div>
                </div>
              </div>
            </SettingsPanel>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
