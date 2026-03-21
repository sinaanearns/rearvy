"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase/client";
import { Insight } from "@/types/database";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { InsightCard } from "./insight-card";
import { InsightDetails } from "./insight-details";
import {
  Filter,
  Lightbulb,
  Loader2,
  PlugZap,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/components/auth-provider";

type InsightsStatusSummary = {
  hasActiveIntegrations: boolean;
  totalSyncedRecords: number;
};

type IntegrationsStatusResponse = {
  integrations?: Array<{ status?: string | null }>;
  syncedData?: Record<string, number | null | undefined>;
};

function toInsight(doc: QueryDocumentSnapshot<DocumentData>): Insight {
  return {
    id: doc.id,
    ...(doc.data() as Omit<Insight, "id">),
  };
}

function normalizeInsights(
  docs: QueryDocumentSnapshot<DocumentData>[],
  filter: string
) {
  return docs
    .map(toInsight)
    .filter((insight) => insight.is_dismissed !== true)
    .filter((insight) =>
      filter === "all" ? true : insight.insight_type === filter
    )
    .sort((left, right) => {
      const leftTime = left.generated_at ? new Date(left.generated_at).getTime() : 0;
      const rightTime = right.generated_at ? new Date(right.generated_at).getTime() : 0;
      return rightTime - leftTime;
    })
    .slice(0, 50);
}

export function InsightsList() {
  const { user, loading: authLoading } = useAuth();
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [selectedInsight, setSelectedInsight] = useState<Insight | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [statusSummary, setStatusSummary] = useState<InsightsStatusSummary | null>(
    null
  );

  useEffect(() => {
    const currentUser = user;
    if (authLoading || !currentUser) return;

    setLoading(true);
    setQueryError(null);

    let active = true;
    let currentUnsubscribe = () => {};

    const applySnapshot = (snapshot: { docs: QueryDocumentSnapshot<DocumentData>[] }) => {
      if (!active) return;

      setInsights(normalizeInsights(snapshot.docs, filter));
      setLoading(false);
      setQueryError(null);
    };

    const handleFatalError = (error: unknown) => {
      if (!active) return;

      console.error("Error fetching insights:", error);
      setInsights([]);
      setLoading(false);
      setQueryError("We couldn't load insights right now.");
    };

    const subscribeWithFallback = () => {
      currentUnsubscribe = onSnapshot(
        query(
          collection(db, COLLECTIONS.INSIGHTS),
          where("user_id", "==", currentUser.uid),
          limit(200)
        ),
        applySnapshot,
        handleFatalError
      );
    };

    currentUnsubscribe = onSnapshot(
      query(
        collection(db, COLLECTIONS.INSIGHTS),
        where("user_id", "==", currentUser.uid),
        where("is_dismissed", "==", false),
        ...(filter !== "all" ? [where("insight_type", "==", filter)] : []),
        orderBy("generated_at", "desc"),
        limit(50)
      ),
      applySnapshot,
      (error) => {
        console.warn(
          "Primary insights query failed, retrying with user-scoped fallback.",
          error
        );
        currentUnsubscribe();
        subscribeWithFallback();
      }
    );

    return () => {
      active = false;
      currentUnsubscribe();
    };
  }, [authLoading, filter, user]);

  useEffect(() => {
    const currentUser = user;
    if (authLoading || !currentUser) return;

    let cancelled = false;

    async function loadStatusSummary() {
      try {
        const token = await currentUser!.getIdToken();
        const response = await fetch("/api/integrations/status", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}`);
        }

        const data = (await response.json()) as IntegrationsStatusResponse;
        if (cancelled) return;

        const hasActiveIntegrations = (data.integrations || []).some(
          (integration) => integration?.status === "active"
        );
        const totalSyncedRecords = Object.values(data.syncedData || {}).reduce<number>(
          (sum, value) => sum + (typeof value === "number" ? value : 0),
          0
        );

        setStatusSummary({
          hasActiveIntegrations,
          totalSyncedRecords,
        });
      } catch (error) {
        console.error("Error loading insights status summary:", error);
        if (!cancelled) {
          setStatusSummary(null);
        }
      }
    }

    void loadStatusSummary();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user]);

  const handleInsightClick = (insight: Insight) => {
    setSelectedInsight(insight);
    setIsDetailsOpen(true);
  };

  const isLoading = authLoading || (Boolean(user) && loading);

  const emptyState = (() => {
    if (filter !== "all") {
      return {
        title: `No ${filter} insights yet`,
        description: `We couldn't find any ${filter} insights matching your current filter.`,
      };
    }

    if (statusSummary?.hasActiveIntegrations === false) {
      return {
        title: "No insights yet",
        description:
          "Connect Shopify, YouTube, or Google Analytics first. Rearvy will generate insights automatically after your first successful syncs.",
      };
    }

    if (statusSummary?.hasActiveIntegrations && statusSummary.totalSyncedRecords === 0) {
      return {
        title: "Your integrations are connected, but there's no synced data yet",
        description:
          "This is normal for a new account. Rearvy needs synced orders, videos, sessions, or other activity before it can generate insights.",
      };
    }

    return {
      title: "No insights generated yet",
      description:
        "Rearvy has not found enough recent signal to create trends, anomalies, or opportunities yet. As more data arrives, insights will appear here automatically.",
    };
  })();

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (queryError) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 py-20 text-center">
        <div className="mb-4 rounded-full bg-muted p-4">
          <RefreshCw className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <h3 className="text-lg font-medium">We couldn&apos;t load insights</h3>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {queryError} Your connected integrations are still safe. Try again in a
          moment, or visit Integrations to verify the latest sync status.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <Button variant="outline" onClick={() => window.location.reload()}>
            Retry
          </Button>
          <Button asChild>
            <Link href="/integrations">Open Integrations</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Recent Intelligence
        </h2>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2">
              <Filter className="h-4 w-4" />
              {filter === "all"
                ? "All Insights"
                : filter.charAt(0).toUpperCase() + filter.slice(1)}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Filter by Type</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFilter("all")}>
              All Insights
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("trend")}>
              Trends
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("anomaly")}>
              Anomalies
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("opportunity")}>
              Opportunities
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setFilter("risk")}>
              Risks
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-muted/10 py-20 text-center">
          <div className="mb-4 rounded-full bg-muted p-4">
            {statusSummary?.hasActiveIntegrations ? (
              <RefreshCw className="h-10 w-10 text-muted-foreground/50" />
            ) : (
              <Lightbulb className="h-10 w-10 text-muted-foreground/50" />
            )}
          </div>
          <h3 className="text-lg font-medium">{emptyState.title}</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {emptyState.description}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {filter !== "all" && (
              <Button variant="outline" onClick={() => setFilter("all")}>
                Clear filters
              </Button>
            )}
            <Button asChild variant="secondary" className="gap-2">
              <Link href="/integrations">
                <PlugZap className="h-4 w-4" />
                Open Integrations
              </Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {insights.map((insight) => (
            <InsightCard
              key={insight.id}
              insight={insight}
              onClick={() => handleInsightClick(insight)}
            />
          ))}
        </div>
      )}

      <InsightDetails
        insight={selectedInsight}
        isOpen={isDetailsOpen}
        onClose={() => setIsDetailsOpen(false)}
      />
    </div>
  );
}
