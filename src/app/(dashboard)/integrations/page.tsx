"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShoppingBag,
  Instagram,
  Youtube,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unplug,
  Package,
  ShoppingCart,
  Loader2,
  Video,
  MessageSquare,
  Image as ImageIcon,
  Globe,
  Eye,
  MousePointer,
  Copy,
  Check,
} from "lucide-react";

type IntegrationData = {
  id: string;
  provider: string;
  provider_account_name: string | null;
  status: "active" | "expired" | "revoked" | "error";
  last_synced_at: string | null;
  scopes: string[];
  created_at: string;
};

type SyncedData = {
  products: number;
  orders: number;
  videos: number;
  youtubeComments: number;
  instagramPosts: number;
  instagramComments: number;
};

type WebsiteData = {
  id: string;
  site_id: string;
  domain: string;
  name: string | null;
  is_active: boolean;
  created_at: string;
};

type IntegrationSlug =
  | "shopify"
  | "youtube"
  | "instagram"
  | "google_analytics";

type IntegrationMeta = {
  title: string;
  subtitle: string;
  description: string;
  category: string;
  capabilityType: string;
  website: string;
  connectLabel: string;
  previewChats: Array<{ user: string; reply: string }>;
};

const INTEGRATION_META: Record<IntegrationSlug, IntegrationMeta> = {
  shopify: {
    title: "Shopify",
    subtitle: "Analyze sales, products, and customer behavior",
    description:
      "Connect your Shopify store so Rearvy can answer questions about your sales performance, products, and customers using real store data.",
    category: "Ecommerce",
    capabilityType: "Interactive",
    website: "shopify.com",
    connectLabel: "Connect Shopify",
    previewChats: [
      {
        user: "@Shopify show my top-selling products this week",
        reply: "Here are your top 3 products this week:\n• Wireless Earbuds — 142 sales (+18%)\n• Phone Stand Pro — 98 sales (+5%)\n• USB-C Hub — 74 sales (−3%)",
      },
      {
        user: "@Shopify how does this month's revenue compare to last month?",
        reply: "This month: $24,810 (+12% vs last month $22,152). Your average order value also increased from $38 to $43.",
      },
      {
        user: "@Shopify which customers haven't ordered in 60+ days?",
        reply: "Found 34 customers inactive for 60+ days. Top spenders include @alice@example.com ($420 LTV) and @bob@example.com ($310 LTV).",
      },
    ],
  },
  youtube: {
    title: "YouTube",
    subtitle: "Understand video performance and audience engagement",
    description:
      "Connect your YouTube channel and ask Rearvy anything about your video performance, watch time, comments, and subscriber trends.",
    category: "Social",
    capabilityType: "Interactive",
    website: "youtube.com",
    connectLabel: "Connect YouTube",
    previewChats: [
      {
        user: "@YouTube which video got the most watch time last month?",
        reply: "\"How I Built a SaaS in 7 Days\" led with 14,320 minutes of watch time — 2.4× your channel average.",
      },
      {
        user: "@YouTube summarize the sentiment in my recent comments",
        reply: "Most recent comments are positive (72%). Common themes: \"clear explanation\", \"very helpful\". 11% requested a follow-up video.",
      },
      {
        user: "@YouTube what's my subscriber growth trend?",
        reply: "You gained 412 subscribers this week, up 28% from last week. Your fastest growth came after Tuesday's upload.",
      },
    ],
  },
  instagram: {
    title: "Instagram",
    subtitle: "Track followers, engagement, and content performance",
    description:
      "Connect your Instagram Business account so Rearvy can analyze your posts, reels, reach, and engagement data in natural language.",
    category: "Social",
    capabilityType: "Interactive",
    website: "instagram.com",
    connectLabel: "Connect Instagram",
    previewChats: [
      {
        user: "@Instagram which posts got the most saves this week?",
        reply: "Your carousel \"5 Design Tips\" received 284 saves — 3× your average. Reels also outperformed static posts in reach.",
      },
      {
        user: "@Instagram compare my reels engagement vs regular posts",
        reply: "Reels avg engagement rate: 6.8%. Static posts: 3.1%. Reels are reaching 2.2× more non-followers this month.",
      },
      {
        user: "@Instagram summarize my audience growth this month",
        reply: "You gained 1,240 followers this month (+8.4%). Best performing day was Friday. 64% of new followers came from Explore.",
      },
    ],
  },
  google_analytics: {
    title: "Google Analytics",
    subtitle: "Turn GA4 data into clear business insights",
    description:
      "Connect your GA4 property so Rearvy can answer questions about website traffic, user behavior, and conversion metrics from your real data.",
    category: "Analytics",
    capabilityType: "Interactive",
    website: "analytics.google.com",
    connectLabel: "Connect Google Analytics",
    previewChats: [
      {
        user: "@Analytics what pages have the highest bounce rate?",
        reply: "Top 3 by bounce rate:\n• /pricing — 78%\n• /blog/post-12 — 71%\n• /contact — 65%\nAll above your site average of 52%.",
      },
      {
        user: "@Analytics compare traffic sources by conversion rate",
        reply: "Organic search converts at 3.2%, email at 5.8%, paid ads at 2.1%. Email campaigns are your most efficient channel.",
      },
      {
        user: "@Analytics how many users visited from mobile this week?",
        reply: "62% of sessions this week were on mobile (4,810 sessions). Mobile bounce rate is 14% higher than desktop.",
      },
    ],
  },
};

export default function IntegrationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [syncedData, setSyncedData] = useState<SyncedData>({
    products: 0,
    orders: 0,
    videos: 0,
    youtubeComments: 0,
    instagramPosts: 0,
    instagramComments: 0,
  });
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [ytConnecting, setYtConnecting] = useState(false);
  const [ytSyncing, setYtSyncing] = useState(false);
  const [ytDisconnecting, setYtDisconnecting] = useState(false);
  const [igConnecting, setIgConnecting] = useState(false);
  const [igSyncing, setIgSyncing] = useState(false);
  const [igDisconnecting, setIgDisconnecting] = useState(false);
  const [ga4Connecting, setGa4Connecting] = useState(false);
  const [ga4Syncing, setGa4Syncing] = useState(false);
  const [ga4Disconnecting, setGa4Disconnecting] = useState(false);
  const [trackingSnippet, setTrackingSnippet] = useState<string | null>(null);
  const [detailsSlug, setDetailsSlug] = useState<IntegrationSlug | null>(null);
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const shopifyIntegration = integrations.find((i) => i.provider === "shopify");
  const youtubeIntegration = integrations.find((i) => i.provider === "youtube");
  const instagramIntegration = integrations.find((i) => i.provider === "instagram");
  const ga4Integration = integrations.find((i) => i.provider === "google_analytics");

  const fetchStatus = useCallback(async () => {
    try {
      if (!user) {
        setIntegrations([]);
        setWebsites([]);
        setLoading(false);
        return;
      }

      const token = await getIdToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/integrations/status", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIntegrations(data.integrations);
        setSyncedData(data.syncedData);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    setLoading(true);
    fetchStatus();
  }, [authLoading, fetchStatus]);

  // Check URL params for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");

    const successMessages: Record<string, string> = {
      shopify_connected: "Shopify connected successfully! Data sync in progress.",
      youtube_connected: "YouTube connected successfully! Data sync in progress.",
      instagram_connected: "Instagram connected successfully! Data sync in progress.",
      google_analytics_connected:
        "Google Analytics connected successfully! Data sync in progress.",
    };

    if (success && successMessages[success]) {
      setSuccessMsg(successMessages[success]);
      window.history.replaceState({}, "", "/integrations");
      fetchStatus();
    }
    if (params.get("error")) {
      setError(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, [fetchStatus]);

  // Shopify handlers
  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError("Please enter your Shopify store domain.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch(
        `/api/integrations/shopify/connect?shop=${encodeURIComponent(shopDomain.trim())}`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start connection");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnecting(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSuccessMsg(
        `Sync complete! ${data.synced.products} products, ${data.synced.orders} orders updated.`
      );
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Are you sure? This will remove all synced Shopify data.")) {
      return;
    }

    setDisconnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/shopify/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Disconnect failed");
      }

      setSuccessMsg("Shopify disconnected.");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setDisconnecting(false);
    }
  };

  // YouTube handlers
  const handleYoutubeConnect = async () => {
    setYtConnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/youtube/connect", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start connection");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setYtConnecting(false);
    }
  };

  const handleYoutubeSync = async () => {
    setYtSyncing(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/youtube/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSuccessMsg(
        `Sync complete! ${data.synced.videos} videos, ${data.synced.comments} comments updated.`
      );
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setYtSyncing(false);
    }
  };

  const handleYoutubeDisconnect = async () => {
    if (!confirm("Are you sure? This will remove all synced YouTube data.")) {
      return;
    }

    setYtDisconnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/youtube/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Disconnect failed");
      }

      setSuccessMsg("YouTube disconnected.");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setYtDisconnecting(false);
    }
  };

  // Instagram handlers
  const handleInstagramConnect = async () => {
    setIgConnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/instagram/connect", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start connection");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setIgConnecting(false);
    }
  };

  const handleInstagramSync = async () => {
    setIgSyncing(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/instagram/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSuccessMsg("Instagram sync complete!");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setIgSyncing(false);
    }
  };

  const handleInstagramDisconnect = async () => {
    if (!confirm("Are you sure? This will remove all synced Instagram data.")) {
      return;
    }

    setIgDisconnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/instagram/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Disconnect failed");
      }

      setSuccessMsg("Instagram disconnected.");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setIgDisconnecting(false);
    }
  };

  // Google Analytics handlers
  const handleGa4Connect = async () => {
    setGa4Connecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/google-analytics/connect", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to start connection");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
      setGa4Connecting(false);
    }
  };

  const handleGa4Sync = async () => {
    setGa4Syncing(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/google-analytics/sync", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Sync failed");
      }

      setSuccessMsg("Google Analytics sync complete!");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setGa4Syncing(false);
    }
  };

  const handleGa4Disconnect = async () => {
    if (!confirm("Are you sure? This will remove all synced Google Analytics data.")) {
      return;
    }

    setGa4Disconnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/google-analytics/disconnect", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        throw new Error("Disconnect failed");
      }

      setSuccessMsg("Google Analytics disconnected.");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setGa4Disconnecting(false);
    }
  };

  const handleCopySnippet = async () => {
    if (!trackingSnippet) return;
    await navigator.clipboard.writeText(trackingSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const handleConnectFromDetails = () => {
    if (!detailsSlug) return;
    if (detailsSlug === "shopify") {
      setDetailsSlug(null);
      setConnectOpen(true);
      return;
    }

    if (detailsSlug === "youtube") { handleYoutubeConnect(); return; }
    if (detailsSlug === "instagram") { handleInstagramConnect(); return; }
    if (detailsSlug === "google_analytics") { handleGa4Connect(); }
  };

  const isDetailConnecting =
    (detailsSlug === "youtube" && ytConnecting) ||
    (detailsSlug === "instagram" && igConnecting) ||
    (detailsSlug === "google_analytics" && ga4Connecting);

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Integrations</h1>
        <p className="text-muted-foreground">
          Connect your platforms so Rearvy can analyze your real data
        </p>
      </div>

      {/* Status messages */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
          <button
            className="ml-auto text-red-500 hover:text-red-700"
            onClick={() => setError(null)}
          >
            &times;
          </button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
          <button
            className="ml-auto text-green-500 hover:text-green-700"
            onClick={() => setSuccessMsg(null)}
          >
            &times;
          </button>
        </div>
      )}

      {/* Shopify Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900">
                <ShoppingBag className="h-5 w-5 text-green-700 dark:text-green-300" />
              </div>
              <div>
                <CardTitle className="text-base">Shopify</CardTitle>
                <CardDescription>
                  Connect your store to analyze sales, products, and customers
                </CardDescription>
              </div>
            </div>
            {shopifyIntegration && (
              <Badge
                variant={
                  shopifyIntegration.status === "active"
                    ? "default"
                    : "destructive"
                }
              >
                {shopifyIntegration.status === "active"
                  ? "Connected"
                  : shopifyIntegration.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : shopifyIntegration && shopifyIntegration.status === "active" ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  {shopifyIntegration.provider_account_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3.5 w-3.5" />
                    {syncedData.products} products
                  </span>
                  <span className="flex items-center gap-1.5">
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {syncedData.orders} orders
                  </span>
                  {shopifyIntegration.last_synced_at && (
                    <span>
                      Last synced:{" "}
                      {formatTime(shopifyIntegration.last_synced_at)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={syncing}
                >
                  {syncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDisconnect}
                  disabled={disconnecting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {disconnecting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Shopify store to let Rearvy analyze your sales
                data, track products, and provide AI-powered insights.
              </p>
              <Button onClick={() => setDetailsSlug("shopify")}>
                <ShoppingBag className="mr-1.5 h-4 w-4" />
                Connect Shopify
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* YouTube Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900">
                <Youtube className="h-5 w-5 text-red-700 dark:text-red-300" />
              </div>
              <div>
                <CardTitle className="text-base">YouTube</CardTitle>
                <CardDescription>
                  Connect your channel to analyze views, subscribers, and
                  engagement
                </CardDescription>
              </div>
            </div>
            {youtubeIntegration && (
              <Badge
                variant={
                  youtubeIntegration.status === "active"
                    ? "default"
                    : "destructive"
                }
              >
                {youtubeIntegration.status === "active"
                  ? "Connected"
                  : youtubeIntegration.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : youtubeIntegration && youtubeIntegration.status === "active" ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  {youtubeIntegration.provider_account_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Video className="h-3.5 w-3.5" />
                    {syncedData.videos} videos
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {syncedData.youtubeComments} comments
                  </span>
                  {youtubeIntegration.last_synced_at && (
                    <span>
                      Last synced:{" "}
                      {formatTime(youtubeIntegration.last_synced_at)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleYoutubeSync}
                  disabled={ytSyncing}
                >
                  {ytSyncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {ytSyncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleYoutubeDisconnect}
                  disabled={ytDisconnecting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {ytDisconnecting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your YouTube channel to let Rearvy analyze your video
                performance, track subscribers, and provide content insights.
              </p>
              <Button onClick={() => setDetailsSlug("youtube")} disabled={ytConnecting}>
                {ytConnecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Redirecting to Google...
                  </>
                ) : (
                  <>
                    <Youtube className="mr-1.5 h-4 w-4" />
                    Connect YouTube
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instagram Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pink-100 dark:bg-pink-900">
                <Instagram className="h-5 w-5 text-pink-700 dark:text-pink-300" />
              </div>
              <div>
                <CardTitle className="text-base">Instagram</CardTitle>
                <CardDescription>
                  Track followers, engagement, and content performance
                </CardDescription>
              </div>
            </div>
            {instagramIntegration && (
              <Badge
                variant={
                  instagramIntegration.status === "active"
                    ? "default"
                    : "destructive"
                }
              >
                {instagramIntegration.status === "active"
                  ? "Connected"
                  : instagramIntegration.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : instagramIntegration && instagramIntegration.status === "active" ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  {instagramIntegration.provider_account_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <ImageIcon className="h-3.5 w-3.5" />
                    {syncedData.instagramPosts} posts
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {syncedData.instagramComments} comments
                  </span>
                  {instagramIntegration.last_synced_at && (
                    <span>
                      Last synced:{" "}
                      {formatTime(instagramIntegration.last_synced_at)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstagramSync}
                  disabled={igSyncing}
                >
                  {igSyncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {igSyncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleInstagramDisconnect}
                  disabled={igDisconnecting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {igDisconnecting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Instagram Business account to track post
                performance, audience growth, and engagement metrics.
              </p>
              <Button onClick={() => setDetailsSlug("instagram")} disabled={igConnecting}>
                {igConnecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Redirecting to Meta...
                  </>
                ) : (
                  <>
                    <Instagram className="mr-1.5 h-4 w-4" />
                    Connect Instagram
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Google Analytics (GA4) Integration Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900">
                <Globe className="h-5 w-5 text-orange-700 dark:text-orange-300" />
              </div>
              <div>
                <CardTitle className="text-base">Google Analytics</CardTitle>
                <CardDescription>
                  Connect your GA4 property to track website metrics and user behavior
                </CardDescription>
              </div>
            </div>
            {ga4Integration && (
              <Badge
                variant={
                  ga4Integration.status === "active"
                    ? "default"
                    : "destructive"
                }
              >
                {ga4Integration.status === "active"
                  ? "Connected"
                  : ga4Integration.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : ga4Integration && ga4Integration.status === "active" ? (
            <div className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm font-medium">
                  {ga4Integration.provider_account_name}
                </p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                  {ga4Integration.last_synced_at && (
                    <span>
                      Last synced:{" "}
                      {formatTime(ga4Integration.last_synced_at)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGa4Sync}
                  disabled={ga4Syncing}
                >
                  {ga4Syncing ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {ga4Syncing ? "Syncing..." : "Sync Now"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleGa4Disconnect}
                  disabled={ga4Disconnecting}
                  className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                >
                  {ga4Disconnecting ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Unplug className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Disconnect
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Connect your Google Analytics 4 property to track website traffic,
                user behavior, and conversion metrics.
              </p>
              <Button onClick={() => setDetailsSlug("google_analytics")} disabled={ga4Connecting}>
                {ga4Connecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Redirecting to Google...
                  </>
                ) : (
                  <>
                    <Globe className="mr-1.5 h-4 w-4" />
                    Connect Google Analytics
                  </>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Details Dialog */}
      {detailsSlug && (() => {
        const meta = INTEGRATION_META[detailsSlug];
        const iconMap: Record<IntegrationSlug, React.ReactNode> = {
          shopify: <ShoppingBag className="h-8 w-8 text-green-700 dark:text-green-300" />,
          youtube: <Youtube className="h-8 w-8 text-red-700 dark:text-red-300" />,
          instagram: <Instagram className="h-8 w-8 text-pink-700 dark:text-pink-300" />,
          google_analytics: <Globe className="h-8 w-8 text-orange-700 dark:text-orange-300" />,
        };
        const bgMap: Record<IntegrationSlug, string> = {
          shopify: "bg-green-100 dark:bg-green-900",
          youtube: "bg-red-100 dark:bg-red-900",
          instagram: "bg-pink-100 dark:bg-pink-900",
          google_analytics: "bg-orange-100 dark:bg-orange-900",
        };
        return (
          <Dialog open onOpenChange={(open) => { if (!open) setDetailsSlug(null); }}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
              {/* Header row */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${bgMap[detailsSlug]}`}>
                    {iconMap[detailsSlug]}
                  </div>
                  <div>
                    <DialogTitle className="text-2xl font-bold">{meta.title}</DialogTitle>
                    <DialogDescription className="mt-0.5 text-sm">{meta.subtitle}</DialogDescription>
                  </div>
                </div>
                <Button
                  className="shrink-0 rounded-full px-5"
                  onClick={handleConnectFromDetails}
                  disabled={isDetailConnecting}
                >
                  {isDetailConnecting ? (
                    <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" />Connecting...</>
                  ) : (
                    meta.connectLabel
                  )}
                </Button>
              </div>

              {/* Description */}
              <p className="mt-2 text-sm text-muted-foreground">{meta.description}</p>

              {/* Chat preview cards */}
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {meta.previewChats.map((chat, i) => (
                  <div
                    key={i}
                    className="rounded-2xl border bg-gradient-to-b from-sky-50 to-indigo-50 p-2.5 dark:from-sky-950/40 dark:to-indigo-950/40"
                  >
                    <div className="rounded-xl bg-white p-3 shadow-sm dark:bg-neutral-900">
                      {/* User bubble */}
                      <div className="mb-3 flex justify-end">
                        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-neutral-100 px-3 py-2 text-xs text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
                          {chat.user}
                        </div>
                      </div>
                      {/* AI reply */}
                      <div className="space-y-1.5">
                        {chat.reply.split("\n").map((line, li) => (
                          <p key={li} className="text-xs leading-relaxed text-neutral-600 dark:text-neutral-400">
                            {line}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <p className="mt-1 text-sm font-medium">{meta.subtitle}</p>

              {/* Information table */}
              <div className="mt-4 space-y-2">
                <h3 className="text-lg font-semibold">Information</h3>
                <div className="overflow-hidden rounded-xl border">
                  <div className="flex border-b">
                    <span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Category</span>
                    <span className="px-4 py-3 text-sm font-medium">{meta.category}</span>
                  </div>
                  <div className="flex border-b">
                    <span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Capabilities</span>
                    <span className="px-4 py-3 text-sm font-medium">{meta.capabilityType}</span>
                  </div>
                  <div className="flex">
                    <span className="w-36 shrink-0 px-4 py-3 text-sm text-muted-foreground">Website</span>
                    <span className="px-4 py-3 text-sm font-medium text-primary">{meta.website}</span>
                  </div>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Shopify Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Shopify Store</DialogTitle>
            <DialogDescription>
              Enter your store domain and you&apos;ll be redirected to Shopify to
              authorize Rearvy.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop-domain">Store domain</Label>
              <Input
                id="shop-domain"
                placeholder="your-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleConnect();
                }}
              />
              <p className="text-xs text-muted-foreground">
                You can enter just the store name (e.g. &quot;your-store&quot;) or the
                full domain.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Redirecting to Shopify...
                </>
              ) : (
                <>
                  <ShoppingBag className="mr-1.5 h-4 w-4" />
                  Connect with Shopify
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tracking Snippet Dialog */}
      <Dialog open={!!trackingSnippet} onOpenChange={() => setTrackingSnippet(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Tracking Script</DialogTitle>
            <DialogDescription>
              Add this snippet to your website&apos;s HTML, just before the
              closing &lt;/head&gt; tag.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="rounded-lg bg-muted p-4">
              <code className="break-all text-sm">{trackingSnippet}</code>
            </div>
            <Button className="w-full" onClick={handleCopySnippet}>
              {snippetCopied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy Snippet
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
