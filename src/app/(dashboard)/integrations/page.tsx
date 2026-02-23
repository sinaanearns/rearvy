"use client";

import { useState, useEffect, useCallback } from "react";
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
  Music2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Unplug,
  Package,
  ShoppingCart,
  Loader2,
  Video,
  MessageSquare,
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
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [syncedData, setSyncedData] = useState<SyncedData>({
    products: 0,
    orders: 0,
    videos: 0,
    youtubeComments: 0,
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
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const shopifyIntegration = integrations.find((i) => i.provider === "shopify");
  const youtubeIntegration = integrations.find((i) => i.provider === "youtube");

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/integrations/status");
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
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check URL params for OAuth callback results
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "shopify_connected") {
      setSuccessMsg("Shopify connected successfully! Data sync in progress.");
      window.history.replaceState({}, "", "/integrations");
      fetchStatus();
    }
    if (params.get("success") === "youtube_connected") {
      setSuccessMsg("YouTube connected successfully! Data sync in progress.");
      window.history.replaceState({}, "", "/integrations");
      fetchStatus();
    }
    if (params.get("error")) {
      setError(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, []);

  // Shopify handlers
  const handleConnect = async () => {
    if (!shopDomain.trim()) {
      setError("Please enter your Shopify store domain.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/integrations/shopify/connect?shop=${encodeURIComponent(shopDomain.trim())}`
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
      const res = await fetch("/api/integrations/shopify/sync", {
        method: "POST",
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
      const res = await fetch("/api/integrations/shopify/disconnect", {
        method: "POST",
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
      const res = await fetch("/api/integrations/youtube/connect");
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
      const res = await fetch("/api/integrations/youtube/sync", {
        method: "POST",
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
      const res = await fetch("/api/integrations/youtube/disconnect", {
        method: "POST",
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

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const comingSoonIntegrations = [
    {
      name: "Instagram",
      description: "Track followers, engagement, and content performance",
      icon: Instagram,
    },
    {
      name: "TikTok",
      description: "Analyze video reach, engagement, and audience demographics",
      icon: Music2,
    },
  ];

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
              <Button onClick={() => setConnectOpen(true)}>
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
              <Button onClick={handleYoutubeConnect} disabled={ytConnecting}>
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

      {/* Coming soon integrations */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">
          Coming Soon
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {comingSoonIntegrations.map((integration) => (
            <Card key={integration.name} className="opacity-60">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <integration.icon className="h-6 w-6" />
                  <Badge variant="secondary" className="text-xs">
                    Coming soon
                  </Badge>
                </div>
                <CardTitle className="text-sm">{integration.name}</CardTitle>
                <CardDescription className="text-xs">
                  {integration.description}
                </CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>

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
    </div>
  );
}
