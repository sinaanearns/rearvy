"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/auth-provider";
import { getIdToken } from "@/lib/firebase/auth";
import type {
  WhisperNetAlert,
  WhisperNetMention,
  WhisperNetWatcher,
} from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  AlertTriangle,
  DollarSign,
  Instagram,
  Loader2,
  Package,
  Radar,
  RefreshCw,
  Search,
  ShieldAlert,
  TrendingUp,
  Trash2,
  Youtube,
} from "lucide-react";

type AvailableProduct = {
  id: string;
  title: string;
  price: number | null;
  inventory_quantity: number | null;
  handle: string | null;
  status: string;
};

type DashboardMention = WhisperNetMention & {
  product_title: string;
  detection_label: string;
  source_title: string | null;
  source_url: string | null;
  creator_name: string | null;
  forecast: {
    predicted_incremental_units_48h: number;
    predicted_incremental_revenue_48h: number;
    confidence: "low" | "medium" | "high";
    stockout_risk: "low" | "medium" | "high" | "critical";
    estimated_hours_until_stockout: number | null;
    rationale: string[];
  } | null;
};

type DashboardAlert = WhisperNetAlert & {
  product_title: string;
  source_title: string | null;
};

type WhisperNetSummaryResponse = {
  watchers: WhisperNetWatcher[];
  availableProducts: AvailableProduct[];
  mentions: DashboardMention[];
  alerts: DashboardAlert[];
  stats: {
    watchedProducts: number;
    activeWatchers: number;
    monitoredContent: number;
    mentionsLast48h: number;
    projectedRevenue48h: number;
    criticalAlerts: number;
  };
  integrations: {
    shopifyConnected: boolean;
    youtubeConnected: boolean;
    instagramConnected: boolean;
  };
  transcriptCoverage: {
    available: number;
    pending: number;
    unavailable: number;
  };
  lastRunAt: string | null;
};

const EMPTY_SUMMARY: WhisperNetSummaryResponse = {
  watchers: [],
  availableProducts: [],
  mentions: [],
  alerts: [],
  stats: {
    watchedProducts: 0,
    activeWatchers: 0,
    monitoredContent: 0,
    mentionsLast48h: 0,
    projectedRevenue48h: 0,
    criticalAlerts: 0,
  },
  integrations: {
    shopifyConnected: false,
    youtubeConnected: false,
    instagramConnected: false,
  },
  transcriptCoverage: {
    available: 0,
    pending: 0,
    unavailable: 0,
  },
  lastRunAt: null,
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function getRiskBadgeVariant(risk: DashboardMention["forecast"]["stockout_risk"] | undefined) {
  if (risk === "critical") return "destructive";
  if (risk === "high") return "default";
  return "secondary";
}

export function WhisperNetDashboard() {
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<WhisperNetSummaryResponse>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [isRunningScan, setIsRunningScan] = useState(false);
  const [isSavingWatcher, setIsSavingWatcher] = useState(false);
  const [pendingWatcherId, setPendingWatcherId] = useState<string | null>(null);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [aliases, setAliases] = useState("");
  const [requiredKeywords, setRequiredKeywords] = useState("");
  const [excludedPhrases, setExcludedPhrases] = useState("");
  const [lowInventoryThreshold, setLowInventoryThreshold] = useState("10");
  const [fuzzyMatch, setFuzzyMatch] = useState(true);

  const loadSummary = useCallback(async () => {
    if (!user) {
      setSummary(EMPTY_SUMMARY);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch("/api/whispernet/summary", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to load WhisperNet summary");
      }

      const data = (await response.json()) as WhisperNetSummaryResponse;
      setSummary(data);
    } catch (error) {
      console.error("Failed to load WhisperNet summary:", error);
      toast.error("Failed to load WhisperNet.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      void loadSummary();
    }
  }, [authLoading, loadSummary]);

  const selectedProduct = useMemo(
    () =>
      summary.availableProducts.find((product) => product.id === selectedProductId) ||
      null,
    [selectedProductId, summary.availableProducts]
  );

  const handleCreateWatcher = async () => {
    if (!selectedProductId) {
      toast.error("Choose a Shopify product first.");
      return;
    }

    if (!user) {
      return;
    }

    setIsSavingWatcher(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch("/api/whispernet/watchers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          productId: selectedProductId,
          aliases,
          requiredKeywords,
          excludedPhrases,
          lowInventoryThreshold: Number(lowInventoryThreshold || 10),
          fuzzyMatch,
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to save watched product");
      }

      toast.success("WhisperNet is now watching that product.");
      setSelectedProductId("");
      setAliases("");
      setRequiredKeywords("");
      setExcludedPhrases("");
      setLowInventoryThreshold("10");
      setFuzzyMatch(true);
      await loadSummary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save watcher.");
    } finally {
      setIsSavingWatcher(false);
    }
  };

  const handleRunScan = async () => {
    if (!user) return;

    setIsRunningScan(true);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch("/api/whispernet/run", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to run WhisperNet scan");
      }

      const payload = (await response.json()) as {
        run?: { stats?: { mentionsDetected?: number; alertsOpen?: number } };
        summary?: WhisperNetSummaryResponse;
      };

      if (payload.summary) {
        setSummary(payload.summary);
      } else {
        await loadSummary();
      }

      toast.success(
        `Scan finished. ${payload.run?.stats?.mentionsDetected || 0} mentions detected.`
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to run WhisperNet.");
    } finally {
      setIsRunningScan(false);
    }
  };

  const handleToggleWatcher = async (watcher: WhisperNetWatcher) => {
    if (!user) return;

    setPendingWatcherId(watcher.id);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch(`/api/whispernet/watchers/${watcher.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ enabled: !watcher.enabled }),
      });

      if (!response.ok) {
        throw new Error("Failed to update watcher");
      }

      await loadSummary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update watcher.");
    } finally {
      setPendingWatcherId(null);
    }
  };

  const handleDeleteWatcher = async (watcherId: string) => {
    if (!user) return;

    setPendingWatcherId(watcherId);
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Missing auth token");
      }

      const response = await fetch(`/api/whispernet/watchers/${watcherId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete watcher");
      }

      toast.success("Watched product removed.");
      await loadSummary();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete watcher.");
    } finally {
      setPendingWatcherId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const socialReady =
    summary.integrations.youtubeConnected || summary.integrations.instagramConnected;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <Radar className="h-5 w-5" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em]">
              WhisperNet
            </span>
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight">
            Product Mention Radar
          </h1>
          <p className="max-w-3xl text-muted-foreground">
            Track watched Shopify products across synced YouTube videos and
            Instagram posts, estimate 48-hour lift, and flag likely stockouts
            before demand outruns inventory.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            onClick={() => void loadSummary()}
            disabled={loading || isRunningScan}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
          <Button
            onClick={() => void handleRunScan()}
            disabled={!summary.watchers.length || !socialReady || isRunningScan}
          >
            {isRunningScan ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Search className="h-4 w-4" />
            )}
            Run scan
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Watched products
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            <span className="text-3xl font-bold">{summary.stats.watchedProducts}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Monitored content
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-primary" />
            <span className="text-3xl font-bold">{summary.stats.monitoredContent}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Mentions in 48h
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <Radar className="h-5 w-5 text-primary" />
            <span className="text-3xl font-bold">{summary.stats.mentionsLast48h}</span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Forecasted revenue
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-primary" />
            <span className="text-3xl font-bold">
              {formatCurrency(summary.stats.projectedRevenue48h)}
            </span>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">
              Critical alerts
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-3">
            <ShieldAlert className="h-5 w-5 text-destructive" />
            <span className="text-3xl font-bold">{summary.stats.criticalAlerts}</span>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_1.2fr]">
        <Card>
          <CardHeader className="space-y-3">
            <CardTitle className="flex items-center gap-2 text-xl">
              <Package className="h-5 w-5 text-primary" />
              Watched Products
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant={summary.integrations.shopifyConnected ? "secondary" : "outline"}>
                Shopify {summary.integrations.shopifyConnected ? "connected" : "missing"}
              </Badge>
              <Badge variant={summary.integrations.youtubeConnected ? "secondary" : "outline"}>
                <Youtube className="mr-1 h-3 w-3" />
                YouTube
              </Badge>
              <Badge variant={summary.integrations.instagramConnected ? "secondary" : "outline"}>
                <Instagram className="mr-1 h-3 w-3" />
                Instagram
              </Badge>
              {summary.lastRunAt ? (
                <span>Last scan: {new Date(summary.lastRunAt).toLocaleString()}</span>
              ) : (
                <span>No scans yet.</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {!summary.integrations.shopifyConnected ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Connect Shopify first so WhisperNet can map mentions to real
                products and inventory.
              </div>
            ) : summary.availableProducts.length === 0 ? (
              <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                Shopify is connected, but no synced products are available yet.
                Run a Shopify sync first.
              </div>
            ) : (
              <div className="space-y-4 rounded-2xl border bg-muted/10 p-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label htmlFor="whispernet-product">Shopify product</Label>
                    <select
                      id="whispernet-product"
                      className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                      value={selectedProductId}
                      onChange={(event) => setSelectedProductId(event.target.value)}
                    >
                      <option value="">Choose a product to watch</option>
                      {summary.availableProducts.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.title}
                          {typeof product.inventory_quantity === "number"
                            ? ` - ${product.inventory_quantity} in stock`
                            : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whispernet-aliases">Aliases</Label>
                    <Textarea
                      id="whispernet-aliases"
                      placeholder="Comma-separated product nicknames"
                      value={aliases}
                      onChange={(event) => setAliases(event.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whispernet-keywords">Required keywords</Label>
                    <Textarea
                      id="whispernet-keywords"
                      placeholder="Optional context keywords, comma-separated"
                      value={requiredKeywords}
                      onChange={(event) => setRequiredKeywords(event.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whispernet-excluded">Excluded phrases</Label>
                    <Textarea
                      id="whispernet-excluded"
                      placeholder="Skip mentions that also include these phrases"
                      value={excludedPhrases}
                      onChange={(event) => setExcludedPhrases(event.target.value)}
                      className="min-h-20"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="whispernet-threshold">Low inventory threshold</Label>
                    <Input
                      id="whispernet-threshold"
                      type="number"
                      min="0"
                      value={lowInventoryThreshold}
                      onChange={(event) => setLowInventoryThreshold(event.target.value)}
                    />
                    <label className="flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={fuzzyMatch}
                        onChange={(event) => setFuzzyMatch(event.target.checked)}
                      />
                      Enable fuzzy matching for slight misspellings
                    </label>
                  </div>
                </div>

                {selectedProduct ? (
                  <div className="rounded-xl border bg-background p-3 text-sm text-muted-foreground">
                    WhisperNet will track <span className="font-medium text-foreground">{selectedProduct.title}</span>
                    {selectedProduct.price ? ` at ${formatCurrency(selectedProduct.price)}` : ""}.
                  </div>
                ) : null}

                <Button onClick={() => void handleCreateWatcher()} disabled={isSavingWatcher}>
                  {isSavingWatcher ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Radar className="h-4 w-4" />
                  )}
                  Add watched product
                </Button>
              </div>
            )}

            <div className="space-y-3">
              {summary.watchers.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  No watched products yet. Add one above, then run a scan.
                </div>
              ) : (
                summary.watchers.map((watcher) => (
                  <div
                    key={watcher.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold">{watcher.product_title}</h3>
                          <Badge variant={watcher.enabled ? "secondary" : "outline"}>
                            {watcher.enabled ? "Active" : "Paused"}
                          </Badge>
                          <Badge variant="outline">
                            Threshold {watcher.low_inventory_threshold}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {watcher.aliases?.length ? (
                            <span>Aliases: {watcher.aliases.join(", ")}</span>
                          ) : (
                            <span>Using the product title as the primary phrase.</span>
                          )}
                          {watcher.last_match_at ? (
                            <span>
                              Last match: {new Date(watcher.last_match_at).toLocaleString()}
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={pendingWatcherId === watcher.id}
                          onClick={() => void handleToggleWatcher(watcher)}
                        >
                          {pendingWatcherId === watcher.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : watcher.enabled ? (
                            "Pause"
                          ) : (
                            "Resume"
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          disabled={pendingWatcherId === watcher.id}
                          onClick={() => void handleDeleteWatcher(watcher.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <AlertTriangle className="h-5 w-5 text-primary" />
                Active Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.alerts.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  No stock-risk alerts are open right now.
                </div>
              ) : (
                summary.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{alert.title}</h3>
                      <Badge
                        variant={
                          alert.severity === "critical" ? "destructive" : "secondary"
                        }
                      >
                        {alert.severity}
                      </Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {alert.summary}
                    </p>
                    <p className="mt-3 text-sm">{alert.recommended_action}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-xl">
                <Radar className="h-5 w-5 text-primary" />
                Recent Mentions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {summary.mentions.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-5 text-sm text-muted-foreground">
                  No product mentions detected yet. Current MVP scans synced
                  YouTube titles/descriptions and Instagram captions. Transcript
                  ingestion is modeled but not active yet.
                </div>
              ) : (
                summary.mentions.map((mention) => (
                  <div
                    key={mention.id}
                    className="rounded-2xl border bg-card p-4 shadow-sm"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{mention.product_title}</h3>
                      <Badge variant="outline">{mention.platform}</Badge>
                      <Badge variant="secondary">{mention.detection_label}</Badge>
                      {mention.forecast ? (
                        <Badge variant={getRiskBadgeVariant(mention.forecast.stockout_risk)}>
                          {mention.forecast.stockout_risk} risk
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-2 text-sm text-muted-foreground">
                      {mention.creator_name ? `${mention.creator_name} · ` : ""}
                      {mention.source_title || "Untitled content"}
                    </div>

                    <p className="mt-3 rounded-xl bg-muted/30 p-3 text-sm leading-6">
                      {mention.context_window}
                    </p>

                    {mention.forecast ? (
                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Revenue in 48h
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {formatCurrency(
                              mention.forecast.predicted_incremental_revenue_48h
                            )}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Units in 48h
                          </p>
                          <p className="mt-1 text-lg font-semibold">
                            {mention.forecast.predicted_incremental_units_48h}
                          </p>
                        </div>
                        <div className="rounded-xl border bg-background p-3">
                          <p className="text-xs uppercase tracking-wide text-muted-foreground">
                            Confidence
                          </p>
                          <p className="mt-1 text-lg font-semibold capitalize">
                            {mention.forecast.confidence}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {mention.published_at ? (
                        <span>
                          Published {new Date(mention.published_at).toLocaleString()}
                        </span>
                      ) : null}
                      {mention.forecast?.estimated_hours_until_stockout ? (
                        <span>
                          Est. stockout in {mention.forecast.estimated_hours_until_stockout}h
                        </span>
                      ) : null}
                    </div>

                    {mention.source_url ? (
                      <div className="mt-3">
                        <Button asChild variant="outline" size="sm">
                          <a href={mention.source_url} target="_blank" rel="noreferrer">
                            Open source
                          </a>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Coverage and Current MVP Scope</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Transcript coverage
            </p>
            <p className="mt-2 text-2xl font-bold">{summary.transcriptCoverage.available}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Transcript-backed items available right now.
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Pending transcript work
            </p>
            <p className="mt-2 text-2xl font-bold">{summary.transcriptCoverage.pending}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reserved for future caption/transcript ingestion.
            </p>
          </div>
          <div className="rounded-2xl border bg-muted/10 p-4">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Text-only fallback
            </p>
            <p className="mt-2 text-2xl font-bold">{summary.transcriptCoverage.unavailable}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Items currently scanned using synced titles, descriptions, and captions.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
