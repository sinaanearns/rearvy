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
  websitePageviews: number;
  websiteSessions: number;
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
  | "google_analytics"
  | "website";

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
    websitePageviews: 0,
    websiteSessions: 0,
  });
  const [websites, setWebsites] = useState<WebsiteData[]>([]);
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
  const [wsConnectOpen, setWsConnectOpen] = useState(false);
  const [wsDomain, setWsDomain] = useState("");
  const [wsConnecting, setWsConnecting] = useState(false);
  const [wsDisconnecting, setWsDisconnecting] = useState<string | null>(null);
  const [trackingSnippet, setTrackingSnippet] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationSlug | null>(null);
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
        setWebsites(data.websites || []);
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

  // Website handlers
  const handleWebsiteConnect = async () => {
    if (!wsDomain.trim()) {
      setError("Please enter your website domain.");
      return;
    }

    setWsConnecting(true);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/website/connect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ domain: wsDomain.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to add website");
      }

      setTrackingSnippet(data.snippet);
      setWsConnectOpen(false);
      setWsDomain("");
      setSuccessMsg(`Website ${data.website.domain} added!`);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add website");
    } finally {
      setWsConnecting(false);
    }
  };

  const handleWebsiteDisconnect = async (websiteId: string, domain: string) => {
    if (!confirm(`Are you sure? This will remove all tracking data for ${domain}.`)) {
      return;
    }

    setWsDisconnecting(websiteId);
    setError(null);

    try {
      const token = await getIdToken();
      const res = await fetch("/api/integrations/website/disconnect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ website_id: websiteId }),
      });

      if (!res.ok) {
        throw new Error("Disconnect failed");
      }

      setSuccessMsg(`Website ${domain} disconnected.`);
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setWsDisconnecting(null);
    }
  };

  const handleCopySnippet = async () => {
    if (!trackingSnippet) return;
    await navigator.clipboard.writeText(trackingSnippet);
    setSnippetCopied(true);
    setTimeout(() => setSnippetCopied(false), 2000);
  };

  const openIntegrationDetails = (integration: IntegrationSlug) => {
    setSelectedIntegration(integration);
    setDetailsOpen(true);
  };

  const selectedDetails =
    selectedIntegration === "shopify"
      ? {
          title: "Shopify",
          subtitle: "Connect your store for ecommerce analytics",
          description:
            "Connect your store to analyze sales, products, and customer trends.",
          capabilities: [
            "Track products and orders",
            "Sync store data automatically",
            "Get AI insights from sales performance",
          ],
          category: "Ecommerce",
          capabilityType: "Interactive",
          website: "shopify.com",
          previewCards: [
            "@Shopify show top-selling products this week",
            "@Shopify compare this month revenue vs last month",
            "@Shopify summarize repeat customer trend",
          ],
          tagline: "Analyze sales, products, and customer behavior",
          connectLabel: "Connect Shopify",
        }
      : selectedIntegration === "youtube"
        ? {
            title: "YouTube",
            subtitle: "Track video performance and engagement",
            description:
              "Connect your channel to analyze video performance and audience engagement.",
            capabilities: [
              "Track video views and comments",
              "Monitor engagement over time",
              "Get content performance insights",
            ],
            category: "Social",
            capabilityType: "Interactive",
            website: "youtube.com",
            previewCards: [
              "@YouTube which videos drove most watch time?",
              "@YouTube summarize sentiment from recent comments",
              "@YouTube suggest content based on top retention",
            ],
            tagline: "Understand content performance with real channel data",
            connectLabel: "Connect YouTube",
          }
        : selectedIntegration === "instagram"
          ? {
              title: "Instagram",
              subtitle: "Monitor growth and post engagement",
              description:
                "Connect your Instagram Business account to monitor growth and engagement.",
              capabilities: [
                "Track post and comment metrics",
                "Measure audience engagement",
                "Understand content performance",
              ],
              category: "Social",
              capabilityType: "Interactive",
              website: "instagram.com",
              previewCards: [
                "@Instagram which posts generated the most saves?",
                "@Instagram compare reels engagement by week",
                "@Instagram summarize audience growth trend",
              ],
              tagline: "Track followers, engagement, and content performance",
              connectLabel: "Connect Instagram",
            }
          : selectedIntegration === "google_analytics"
            ? {
                title: "Google Analytics",
                subtitle: "Understand website traffic and behavior",
                description:
                  "Connect your GA4 property to track website behavior and conversion trends.",
                capabilities: [
                  "Track website traffic and sessions",
                  "Monitor user behavior metrics",
                  "Use analytics data in AI insights",
                ],
                category: "Analytics",
                capabilityType: "Interactive",
                website: "analytics.google.com",
                previewCards: [
                  "@GA4 what pages have highest bounce rate?",
                  "@GA4 compare traffic sources by conversion",
                  "@GA4 summarize sessions by country",
                ],
                tagline: "Turn GA4 data into clear business insights",
                connectLabel: "Connect Google Analytics",
              }
            : selectedIntegration === "website"
              ? {
                  title: "Website Tracking",
                  subtitle: "Add lightweight first-party tracking",
                  description:
                    "Add your website to track visitors, pageviews, clicks, and custom events.",
                  capabilities: [
                    "Track pageviews and sessions",
                    "Capture clicks and scroll depth",
                    "Install with one lightweight script",
                  ],
                  category: "Tracking",
                  capabilityType: "Interactive",
                  website: "rearvy.com",
                  previewCards: [
                    "Track pageviews, sessions, and click events",
                    "Measure scroll depth and engagement signals",
                    "Send custom events from your product flows",
                  ],
                  tagline: "Add website tracking in minutes",
                  connectLabel: "Add Website",
                }
              : null;

  const detailsIcon =
    selectedIntegration === "shopify"
      ? ShoppingBag
      : selectedIntegration === "youtube"
        ? Youtube
        : selectedIntegration === "instagram"
          ? Instagram
          : Globe;

  const detailsIconColor =
    selectedIntegration === "shopify"
      ? "text-green-700 dark:text-green-300"
      : selectedIntegration === "youtube"
        ? "text-red-700 dark:text-red-300"
        : selectedIntegration === "instagram"
          ? "text-pink-700 dark:text-pink-300"
          : selectedIntegration === "website"
            ? "text-blue-700 dark:text-blue-300"
            : "text-orange-700 dark:text-orange-300";

  const detailsIconBg =
    selectedIntegration === "shopify"
      ? "bg-green-100 dark:bg-green-900"
      : selectedIntegration === "youtube"
        ? "bg-red-100 dark:bg-red-900"
        : selectedIntegration === "instagram"
          ? "bg-pink-100 dark:bg-pink-900"
          : selectedIntegration === "website"
            ? "bg-blue-100 dark:bg-blue-900"
            : "bg-orange-100 dark:bg-orange-900";

  const isSelectedConnecting =
    (selectedIntegration === "shopify" && connecting) ||
    (selectedIntegration === "youtube" && ytConnecting) ||
    (selectedIntegration === "instagram" && igConnecting) ||
    (selectedIntegration === "google_analytics" && ga4Connecting) ||
    (selectedIntegration === "website" && wsConnecting);

  const handleConnectFromDetails = () => {
    if (!selectedIntegration) return;

    if (selectedIntegration === "shopify") {
      setDetailsOpen(false);
      setConnectOpen(true);
      return;
    }
    if (selectedIntegration === "website") {
      setDetailsOpen(false);
      setWsConnectOpen(true);
      return;
    }
    if (selectedIntegration === "youtube") {
      handleYoutubeConnect();
      return;
    }
    if (selectedIntegration === "instagram") {
      handleInstagramConnect();
      return;
    }
    if (selectedIntegration === "google_analytics") {
      handleGa4Connect();
    }
  };

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
              <Button onClick={() => openIntegrationDetails("shopify")}>
                <ShoppingBag className="mr-1.5 h-4 w-4" />
                View Shopify Details
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
              <Button onClick={() => openIntegrationDetails("youtube")}>
                <Youtube className="mr-1.5 h-4 w-4" />
                View YouTube Details
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
              <Button onClick={() => openIntegrationDetails("instagram")}>
                <Instagram className="mr-1.5 h-4 w-4" />
                View Instagram Details
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
              <Button onClick={() => openIntegrationDetails("google_analytics")}>
                <Globe className="mr-1.5 h-4 w-4" />
                View Google Analytics Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Website Tracking Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900">
                <Globe className="h-5 w-5 text-blue-700 dark:text-blue-300" />
              </div>
              <div>
                <CardTitle className="text-base">Website Tracking</CardTitle>
                <CardDescription>
                  Add your website to track visitors, pageviews, and events
                </CardDescription>
              </div>
            </div>
            {websites.length > 0 && (
              <Badge variant="default">
                {websites.length} site{websites.length > 1 ? "s" : ""}
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
          ) : websites.length > 0 ? (
            <div className="space-y-4">
              {websites.map((ws) => (
                <div key={ws.id} className="rounded-lg bg-muted/50 p-4">
                  <p className="text-sm font-medium">{ws.domain}</p>
                  {ws.name && ws.name !== ws.domain && (
                    <p className="text-xs text-muted-foreground">{ws.name}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3.5 w-3.5" />
                      {syncedData.websitePageviews} pageviews
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MousePointer className="h-3.5 w-3.5" />
                      {syncedData.websiteSessions} sessions
                    </span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setTrackingSnippet(
                          `<script defer src="${window.location.origin}/t.js" data-site="${ws.site_id}"></script>`
                        )
                      }
                    >
                      <Copy className="mr-1.5 h-3.5 w-3.5" />
                      Get Snippet
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleWebsiteDisconnect(ws.id, ws.domain)}
                      disabled={wsDisconnecting === ws.id}
                      className="text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950"
                    >
                      {wsDisconnecting === ws.id ? (
                        <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Unplug className="mr-1.5 h-3.5 w-3.5" />
                      )}
                      Disconnect
                    </Button>
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                onClick={() => setWsConnectOpen(true)}
              >
                <Globe className="mr-1.5 h-4 w-4" />
                Add Another Website
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Add a lightweight tracking script to your website to track
                visitors, pageviews, clicks, scroll depth, and custom events.
              </p>
              <Button onClick={() => openIntegrationDetails("website")}>
                <Globe className="mr-1.5 h-4 w-4" />
                View Website Details
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Integration Details Dialog */}
      <Dialog
        open={detailsOpen}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          if (!open) {
            setSelectedIntegration(null);
          }
        }}
      >
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-4xl">
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-full ${detailsIconBg}`}
                >
                  {(() => {
                    const Icon = detailsIcon;
                    return <Icon className={`h-8 w-8 ${detailsIconColor}`} />;
                  })()}
                </div>
                <div className="space-y-1">
                  <DialogTitle className="text-3xl font-semibold tracking-tight">
                    {selectedDetails?.title ?? "Integration"}
                  </DialogTitle>
                  <DialogDescription className="text-lg text-muted-foreground">
                    {selectedDetails?.subtitle ?? "Review before connecting"}
                  </DialogDescription>
                </div>
              </div>

              <Button
                className="rounded-full px-6"
                onClick={handleConnectFromDetails}
                disabled={isSelectedConnecting || !selectedIntegration}
              >
                {isSelectedConnecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    Connecting
                  </>
                ) : (
                  selectedDetails?.connectLabel ?? "Connect"
                )}
              </Button>
            </div>

            <p className="text-base text-muted-foreground">
              {selectedDetails?.description ?? "Review this integration before connecting."}
            </p>

            <div className="grid gap-3 md:grid-cols-3">
              {(selectedDetails?.previewCards ?? []).map((prompt, idx) => (
                <div
                  key={`${prompt}-${idx}`}
                  className="rounded-2xl border bg-gradient-to-b from-cyan-100 to-blue-100 p-3 dark:from-cyan-900/30 dark:to-blue-900/30"
                >
                  <div className="rounded-xl bg-white/90 p-3 dark:bg-black/40">
                    <p className="text-xs text-muted-foreground">{prompt}</p>
                    <div className="mt-3 rounded-lg bg-black/5 p-3 dark:bg-white/10">
                      <div className="h-2 w-4/5 rounded bg-black/20 dark:bg-white/20" />
                      <div className="mt-2 h-2 w-3/5 rounded bg-black/20 dark:bg-white/20" />
                      <div className="mt-2 h-2 w-2/5 rounded bg-black/20 dark:bg-white/20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <p className="text-base font-medium">{selectedDetails?.tagline}</p>

            <div className="space-y-3">
              <h3 className="text-2xl font-semibold tracking-tight">Information</h3>
              <div className="overflow-hidden rounded-xl border">
                <div className="grid grid-cols-2 border-b">
                  <div className="px-4 py-3 text-sm text-muted-foreground">Category</div>
                  <div className="px-4 py-3 text-sm font-medium">{selectedDetails?.category}</div>
                </div>
                <div className="grid grid-cols-2 border-b">
                  <div className="px-4 py-3 text-sm text-muted-foreground">Capabilities</div>
                  <div className="px-4 py-3 text-sm font-medium">{selectedDetails?.capabilityType}</div>
                </div>
                <div className="grid grid-cols-2">
                  <div className="px-4 py-3 text-sm text-muted-foreground">Website</div>
                  <div className="px-4 py-3 text-sm font-medium">{selectedDetails?.website}</div>
                </div>
              </div>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4">
              <p className="text-sm font-medium">What you get</p>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">
                {(selectedDetails?.capabilities ?? []).map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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

      {/* Website Connect Dialog */}
      <Dialog open={wsConnectOpen} onOpenChange={setWsConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Website</DialogTitle>
            <DialogDescription>
              Enter your website domain to get a tracking script.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ws-domain">Website domain</Label>
              <Input
                id="ws-domain"
                placeholder="example.com"
                value={wsDomain}
                onChange={(e) => setWsDomain(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleWebsiteConnect();
                }}
              />
              <p className="text-xs text-muted-foreground">
                Enter the domain without https:// (e.g. &quot;example.com&quot;)
              </p>
            </div>

            <Button
              className="w-full"
              onClick={handleWebsiteConnect}
              disabled={wsConnecting}
            >
              {wsConnecting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Globe className="mr-1.5 h-4 w-4" />
                  Add Website
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
