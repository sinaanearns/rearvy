"use client";

import Link from "next/link";
import { useState, useCallback, useMemo, useRef } from "react";
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  MapRoute,
  MapArc,
  MapClusterLayer,
  type MapArcDatum,
  type MapRef,
} from "@/components/ui/map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe2,
  ShoppingCart,
  Users,
  MapPin,
  BarChart3,
  Database,
  Eye,
  EyeOff,
  Layers,
  Activity,
  Search,
  PlugZap,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Data types                                                         */
/* ------------------------------------------------------------------ */

type MarketNode = {
  id: string;
  name: string;
  city: string;
  country: string;
  coordinates: [number, number]; // [lng, lat]
  revenue: number;
  orders: number;
  customers: number;
  growth: number; // percentage
  category: "primary" | "secondary" | "emerging";
};

type TradeArc = MapArcDatum & {
  from: [number, number];
  to: [number, number];
  volume: number;
  label: string;
};

type ShippingRoute = {
  id: string;
  label: string;
  coordinates: [number, number][];
  color: string;
};

/* ------------------------------------------------------------------ */
/*  Demo data - financial hubs, arcs, routes                            */
/* ------------------------------------------------------------------ */

const MARKET_NODES: MarketNode[] = [];

const TRADE_ARCS: TradeArc[] = [];

const SHIPPING_ROUTES: ShippingRoute[] = [];

// Transaction clusters data (GeoJSON)
const TRANSACTIONS_DATA: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toString();
}

const categoryColors: Record<MarketNode["category"], string> = {
  primary: "#8b5cf6",
  secondary: "#3b82f6",
  emerging: "#22c55e",
};

const categorySizes: Record<MarketNode["category"], string> = {
  primary: "h-5 w-5",
  secondary: "h-4 w-4",
  emerging: "h-3 w-3",
};

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function MarkerDot({ node }: { node: MarketNode }) {
  const color = categoryColors[node.category];
  const sizeClass = categorySizes[node.category];

  return (
    <div className="relative group/marker">
      {/* Pulse ring */}
      <div
        className={cn(
          "absolute inset-0 rounded-full animate-ping opacity-30",
          sizeClass
        )}
        style={{ backgroundColor: color }}
      />
      {/* Core dot */}
      <div
        className={cn(
          "relative rounded-full border-2 border-white/80 shadow-sm shadow-black/20",
          sizeClass
        )}
        style={{ backgroundColor: color }}
      />
      {/* Growth indicator */}
      {node.growth > 20 && (
        <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[6px] font-bold text-white shadow">
          <TrendingUp className="h-2 w-2" />
        </div>
      )}
    </div>
  );
}

function PopupCard({ node }: { node: MarketNode }) {
  return (
    <div className="w-64 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">{node.name}</h3>
          <p className="text-xs text-muted-foreground">
            {node.city}, {node.country}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "text-[10px] capitalize",
            node.category === "primary" && "border-violet-500/50 text-violet-400",
            node.category === "secondary" && "border-blue-500/50 text-blue-400",
            node.category === "emerging" && "border-emerald-500/50 text-emerald-400"
          )}
        >
          {node.category}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <MetricCell
          icon={<DollarSign className="h-3 w-3" />}
          label="Revenue"
          value={formatCurrency(node.revenue)}
        />
        <MetricCell
          icon={<ShoppingCart className="h-3 w-3" />}
          label="Orders"
          value={formatNumber(node.orders)}
        />
        <MetricCell
          icon={<Users className="h-3 w-3" />}
          label="Customers"
          value={formatNumber(node.customers)}
        />
        <MetricCell
          icon={
            node.growth >= 0 ? (
              <TrendingUp className="h-3 w-3 text-emerald-500" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-500" />
            )
          }
          label="Growth"
          value={`${node.growth > 0 ? "+" : ""}${node.growth}%`}
          valueClassName={node.growth >= 0 ? "text-emerald-500" : "text-red-500"}
        />
      </div>
    </div>
  );
}

function MetricCell({
  icon,
  label,
  value,
  valueClassName,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-[8px] bg-muted/50 p-2">
      <div className="flex items-center gap-1 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px]">{label}</span>
      </div>
      <p className={cn("text-sm font-semibold", valueClassName)}>{value}</p>
    </div>
  );
}

function StatsBar({ nodes }: { nodes: MarketNode[] }) {
  const totalRevenue = nodes.reduce((sum, n) => sum + n.revenue, 0);
  const totalOrders = nodes.reduce((sum, n) => sum + n.orders, 0);
  const totalCustomers = nodes.reduce((sum, n) => sum + n.customers, 0);
  const avgGrowth =
    nodes.length > 0 ? nodes.reduce((sum, n) => sum + n.growth, 0) / nodes.length : 0;

  return (
    <div className="absolute top-3 left-3 z-10 flex flex-wrap gap-2 max-w-[calc(100%-120px)]">
      {[
        {
          icon: <DollarSign className="h-3.5 w-3.5 text-violet-400" />,
          label: "Total Revenue",
          value: formatCurrency(totalRevenue),
        },
        {
          icon: <ShoppingCart className="h-3.5 w-3.5 text-blue-400" />,
          label: "Orders",
          value: formatNumber(totalOrders),
        },
        {
          icon: <Users className="h-3.5 w-3.5 text-cyan-400" />,
          label: "Customers",
          value: formatNumber(totalCustomers),
        },
        {
          icon: <Activity className="h-3.5 w-3.5 text-emerald-400" />,
          label: "Avg Growth",
          value: `+${avgGrowth.toFixed(1)}%`,
        },
      ].map((stat) => (
        <div
          key={stat.label}
          className="flex items-center gap-2 rounded-[8px] border border-border/50 bg-background/80 px-3 py-1.5 shadow-sm backdrop-blur-md"
        >
          {stat.icon}
          <div className="leading-tight">
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
            <p className="text-xs font-semibold">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Layer toggles                                                      */
/* ------------------------------------------------------------------ */

type LayerVisibility = {
  markers: boolean;
  arcs: boolean;
  routes: boolean;
  transactions: boolean;
  globe: boolean;
};

function LayerToggle({
  layers,
  onChange,
}: {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
}) {
  const items: { key: keyof LayerVisibility; label: string; color: string }[] = [
    { key: "markers", label: "Markets", color: "bg-violet-500" },
    { key: "arcs", label: "Trade Flows", color: "bg-amber-500" },
    { key: "routes", label: "Shipping", color: "bg-cyan-500" },
    { key: "transactions", label: "Transactions", color: "bg-rose-500" },
    { key: "globe", label: "3D Globe", color: "bg-slate-400" },
  ];

  return (
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-[8px] border border-border/50 bg-background/80 p-2 shadow-sm backdrop-blur-md">
      <div className="flex items-center gap-1.5 px-1 pb-1 text-xs font-medium text-muted-foreground">
        <Layers className="h-3 w-3" />
        Layers
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange({ ...layers, [item.key]: !layers[item.key] })}
          className={cn(
            "flex items-center gap-2 rounded-[8px] px-2 py-1 text-xs transition-colors",
            layers[item.key]
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50"
          )}
        >
          {layers[item.key] ? (
            <Eye className="h-3 w-3" />
          ) : (
            <EyeOff className="h-3 w-3" />
          )}
          <span className={cn("h-2 w-2 rounded-full", item.color)} />
          {item.label}
        </button>
      ))}
    </div>
  );
}

function EmptyInsightsMap() {
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="relative min-h-[520px] overflow-hidden rounded-[8px] border border-border/70 bg-slate-950 p-6 text-white shadow-sm shadow-slate-950/20 sm:p-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(20,184,166,0.24),transparent_28%),radial-gradient(circle_at_80%_12%,rgba(99,102,241,0.2),transparent_30%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="relative flex h-full flex-col justify-between gap-10">
          <div className="max-w-2xl space-y-5">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100 shadow-sm shadow-black/25">
              <Globe2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-cyan-200">
                No insight data yet
              </p>
              <h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                Connect client sources to light up the market map.
              </h2>
              <p className="max-w-xl text-sm leading-6 text-white/66 sm:text-base">
                Rearvy will turn connected commerce, analytics, and workspace activity into signals instead of showing placeholder metrics.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild className="h-10 rounded-[8px] bg-white font-semibold text-slate-950 hover:bg-white/86">
                <Link href="/integrations">
                  Connect integrations
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-10 rounded-[8px] border-white/18 bg-white/8 text-white hover:bg-white/10 hover:text-white"
              >
                <Link href="/work/sources">
                  Review sources
                </Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Commerce", value: "Revenue, orders, customers", icon: ShoppingCart },
              { label: "Analytics", value: "Trends and source movement", icon: BarChart3 },
              { label: "Workspace", value: "Briefs and decisions", icon: Sparkles },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="rounded-[8px] border border-white/12 bg-white/8 p-4 backdrop-blur"
                >
                  <Icon className="h-4 w-4 text-cyan-200" aria-hidden="true" />
                  <p className="mt-3 text-sm font-semibold text-white">{item.label}</p>
                  <p className="mt-1 text-xs leading-5 text-white/58">{item.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="grid gap-4">
        {[
          {
            icon: PlugZap,
            title: "Connect sources",
            detail: "Authorize supported integrations so Rearvy can read real client context.",
          },
          {
            icon: Database,
            title: "Sync evidence",
            detail: "Keep the source layer fresh before generating performance signals.",
          },
          {
            icon: Activity,
            title: "Review insights",
            detail: "Use the map, feed, and cards once live signals are available.",
          },
        ].map((step, index) => {
          const Icon = step.icon;

          return (
            <div
              key={step.title}
              className="rounded-[8px] border border-border/70 bg-background/78 p-4 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 text-cyan-600 dark:text-cyan-200">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-1 text-sm font-semibold text-foreground">{step.title}</h3>
                  <p className="mt-1 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function InsightsMap() {
  // Use mapRef to access the map instance from the parent
  const mapRef = useRef<MapRef | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [layers, setLayers] = useState<LayerVisibility>({
    markers: true,
    arcs: true,
    routes: true,
    transactions: false,
    globe: false,
  });

  const handleMarkerClick = useCallback((nodeId: string) => {
    setSelectedNode((prev) => (prev === nodeId ? null : nodeId));
  }, []);

  const arcData = useMemo(() => TRADE_ARCS, []);

  const handleSearch = (node: MarketNode) => {
    setSearchQuery(node.city);
    mapRef.current?.flyTo({
      center: node.coordinates,
      zoom: 6,
      duration: 2000,
      essential: true,
    });
    setSelectedNode(node.id);
  };

  if (MARKET_NODES.length === 0) {
    return <EmptyInsightsMap />;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-violet-500/20 bg-violet-500/10">
            <Globe2 className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Global Market Intelligence
            </h2>
            <p className="text-sm text-muted-foreground">
              Live overview of your market presence, trade flows &amp; shipping corridors
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {/* Search bar */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-64 rounded-[8px] border border-input bg-background pl-9 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {searchQuery && (
              <div className="absolute top-full z-20 mt-1 w-full rounded-[8px] border border-border bg-background shadow-sm">
                {MARKET_NODES.filter((n) =>
                  n.city.toLowerCase().includes(searchQuery.toLowerCase())
                ).map((node) => (
                  <button
                    key={node.id}
                    onClick={() => handleSearch(node)}
                    className="flex w-full items-center px-3 py-2 text-sm hover:bg-accent"
                  >
                    {node.city}, {node.country}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 text-xs">
              <MapPin className="h-3 w-3" />
              {MARKET_NODES.length} Markets
            </Badge>
          </div>
        </div>
      </div>

      {/* Map card */}
      <Card className="overflow-hidden border-border/50 p-0 shadow-sm shadow-slate-950/[0.03]">
        <div className="relative h-[520px]">
          <Map
            ref={mapRef}
            center={[20, 20]}
            zoom={1.8}
            minZoom={1.5}
            maxZoom={12}
            theme="dark"
            projection={layers.globe ? { type: "globe" } : { type: "mercator" }}
            className="rounded-[8px]"
          >
            {/* Aggregated stats overlay */}
            <StatsBar nodes={MARKET_NODES} />

            {/* Controls */}
            <MapControls
              position="top-right"
              showZoom
              showCompass
              showFullscreen
            />

            {/* Layer toggle */}
            <LayerToggle layers={layers} onChange={setLayers} />

            {/* Transaction clusters */}
            {layers.transactions && (
              <MapClusterLayer
                data={TRANSACTIONS_DATA}
                clusterRadius={40}
                clusterMaxZoom={10}
                clusterColors={["#f43f5e", "#fb7185", "#fda4af"]}
                pointColor="#f43f5e"
              />
            )}

            {/* Trade-flow arcs */}
            {layers.arcs && (
              <MapArc
                data={arcData}
                curvature={0.35}
                paint={{
                  "line-color": "#f59e0b",
                  "line-width": 1.5,
                  "line-opacity": 0.5,
                }}
                hoverPaint={{
                  "line-color": "#fbbf24",
                  "line-width": 3,
                  "line-opacity": 0.9,
                }}
              />
            )}

            {/* Shipping routes */}
            {layers.routes &&
              SHIPPING_ROUTES.map((route) => (
                <MapRoute
                  key={route.id}
                  id={route.id}
                  coordinates={route.coordinates}
                  color={route.color}
                  width={2}
                  opacity={0.45}
                  dashArray={[4, 4]}
                />
              ))}

            {/* Market markers */}
            {layers.markers &&
              MARKET_NODES.map((node) => (
                <MapMarker
                  key={node.id}
                  longitude={node.coordinates[0]}
                  latitude={node.coordinates[1]}
                  onClick={() => handleMarkerClick(node.id)}
                >
                  <MarkerContent>
                    <MarkerDot node={node} />
                  </MarkerContent>

                  <MarkerTooltip>
                    <span className="font-medium">{node.city}</span>
                    {" | "}
                    <span className="text-emerald-300">
                      {formatCurrency(node.revenue)}
                    </span>
                  </MarkerTooltip>

                  {selectedNode === node.id && (
                    <MarkerPopup closeButton offset={20}>
                      <PopupCard node={node} />
                    </MarkerPopup>
                  )}
                </MapMarker>
              ))}
          </Map>
        </div>
      </Card>

      {/* Market cards grid */}
      <div className="grid gap-4 lg:grid-cols-4">
        {/* Left side: Market cards */}
        <div className="lg:col-span-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {MARKET_NODES.map((node) => (
            <Card
              key={node.id}
              className={cn(
                "group cursor-pointer transition-all hover:shadow-md p-0",
                selectedNode === node.id &&
                  "ring-2 ring-violet-500/50 shadow-violet-500/10"
              )}
              onClick={() => handleMarkerClick(node.id)}
            >
              <CardHeader className="p-3 pb-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: categoryColors[node.category] }}
                    />
                    <CardTitle className="text-xs font-semibold">
                      {node.city}
                    </CardTitle>
                  </div>
                  <span
                    className={cn(
                      "text-[10px] font-semibold",
                      node.growth >= 0 ? "text-emerald-500" : "text-red-500"
                    )}
                  >
                    {node.growth > 0 ? "+" : ""}
                    {node.growth}%
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-3 pt-0">
                <p className="text-base font-semibold">
                  {formatCurrency(node.revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatNumber(node.orders)} orders{" | "}
                  {formatNumber(node.customers)} customers
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Right side: Live Feed */}
        <Card className="lg:col-span-1 h-full border-border/50 bg-muted/20">
          <CardHeader className="p-4 pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-rose-500" />
                Live Intelligence
              </CardTitle>
              <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 no-scrollbar">
              {[
                { time: "Just now", city: "Singapore", event: "Large B2B order processed", amount: "+$24,500" },
                { time: "2m ago", city: "London", event: "New customer acquisition milestone", amount: "+124 users" },
                { time: "5m ago", city: "New York", event: "Market share increased", amount: "+0.4%" },
                { time: "12m ago", city: "Tokyo", event: "Supply chain route optimized", amount: "-12% latency" },
                { time: "18m ago", city: "Mumbai", event: "Emerging market growth surge", amount: "+42% WoW" },
                { time: "25m ago", city: "Berlin", event: "Subscription renewal batch", amount: "+$12,000" },
              ].map((item, i) => (
                <div key={i} className="relative pl-4 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-violet-500/30">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] font-medium text-violet-400">{item.city}</span>
                    <span className="text-[10px] text-muted-foreground">{item.time}</span>
                  </div>
                  <p className="text-xs font-medium mb-0.5">{item.event}</p>
                  <p className="text-[10px] font-semibold text-emerald-500">{item.amount}</p>
                </div>
              ))}
            </div>
            <Button variant="ghost" className="w-full mt-4 text-[11px] h-8 text-muted-foreground">
              View all activities
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
