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
};

export default function IntegrationsPage() {
  const [integrations, setIntegrations] = useState<IntegrationData[]>([]);
  const [syncedData, setSyncedData] = useState<SyncedData>({
    products: 0,
    orders: 0,
  });
  const [loading, setLoading] = useState(true);
  const [connectOpen, setConnectOpen] = useState(false);
  const [shopDomain, setShopDomain] = useState("");
  const [accessToken, setAccessToken] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const shopifyIntegration = integrations.find((i) => i.provider === "shopify");

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
    if (params.get("error")) {
      setError(`Connection failed: ${params.get("error")}`);
      window.history.replaceState({}, "", "/integrations");
    }
  }, [fetchStatus]);

  const handleConnect = async () => {
    if (!shopDomain.trim() || !accessToken.trim()) {
      setError("Please enter both your shop domain and access token.");
      return;
    }

    setConnecting(true);
    setError(null);

    try {
      const res = await fetch("/api/integrations/shopify/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shopDomain: shopDomain.trim(),
          accessToken: accessToken.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Connection failed");
      }

      setSuccessMsg(
        `Connected to ${data.shop}! Synced ${data.synced.products} products and ${data.synced.orders} orders.`
      );
      setConnectOpen(false);
      setShopDomain("");
      setAccessToken("");
      fetchStatus();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Connection failed");
    } finally {
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
      name: "YouTube",
      description: "Monitor subscribers, views, and video analytics",
      icon: Youtube,
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
              {/* Connected info */}
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

              {/* Actions */}
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

      {/* Coming soon integrations */}
      <div>
        <h2 className="mb-3 text-lg font-semibold text-muted-foreground">
          Coming Soon
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
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

      {/* Connect Dialog */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Connect Shopify Store</DialogTitle>
            <DialogDescription>
              Create a custom app in your Shopify admin to get an access token.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Instructions */}
            <div className="rounded-lg bg-muted/50 p-3 text-sm">
              <p className="font-medium">How to get your access token:</p>
              <ol className="mt-2 list-inside list-decimal space-y-1 text-muted-foreground">
                <li>
                  Go to Shopify Admin &rarr; Settings &rarr; Apps and sales
                  channels
                </li>
                <li>Click &ldquo;Develop apps&rdquo; &rarr; Create an app</li>
                <li>
                  Configure API scopes: read_products, read_orders,
                  read_customers, read_inventory
                </li>
                <li>Install the app and copy the Admin API access token</li>
              </ol>
            </div>

            <div className="space-y-2">
              <Label htmlFor="shop-domain">Store domain</Label>
              <Input
                id="shop-domain"
                placeholder="your-store.myshopify.com"
                value={shopDomain}
                onChange={(e) => setShopDomain(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access-token">Admin API access token</Label>
              <Input
                id="access-token"
                type="password"
                placeholder="shpat_xxxxxxxxxxxxx"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
              />
            </div>

            <Button
              className="w-full"
              onClick={handleConnect}
              disabled={connecting}
            >
              {connecting ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                "Connect Store"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
