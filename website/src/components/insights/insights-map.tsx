"use client";

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
} from "@/components/ui/map";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Globe2,
  ShoppingCart,
  Users,
  MapPin,
  BarChart3,
  Eye,
  EyeOff,
  Layers,
  Activity,
  Search,
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
/*  Demo data — financial hubs, arcs, routes                           */
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
          "relative rounded-full border-2 border-white/80 shadow-lg shadow-black/30",
          sizeClass
        )}
        style={{ backgroundColor: color }}
      />
      {/* Growth indicator */}
      {node.growth > 20 && (
        <div className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-emerald-500 text-[6px] font-bold text-white shadow">
          ↑
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
    <div className="rounded-md bg-muted/50 p-2">
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
    nodes.reduce((sum, n) => sum + n.growth, 0) / nodes.length;

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
          className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/80 backdrop-blur-md px-3 py-1.5 shadow-sm"
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
    <div className="absolute bottom-3 left-3 z-10 flex flex-col gap-1 rounded-lg border border-border/50 bg-background/80 backdrop-blur-md p-2 shadow-sm">
      <div className="flex items-center gap-1.5 px-1 pb-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
        <Layers className="h-3 w-3" />
        Layers
      </div>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={() => onChange({ ...layers, [item.key]: !layers[item.key] })}
          className={cn(
            "flex items-center gap-2 rounded-md px-2 py-1 text-xs transition-colors",
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

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function InsightsMap() {
  // Use mapRef to access the map instance from the parent
  const mapRef = useRef<any>(null);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/20 to-blue-500/20 border border-violet-500/20">
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
              className="h-9 w-64 rounded-md border border-input bg-background pl-9 pr-3 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
            {searchQuery && (
              <div className="absolute top-full z-20 mt-1 w-full rounded-md border border-border bg-background shadow-lg">
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
      <Card className="overflow-hidden border-border/50 shadow-xl p-0">
        <div className="relative h-[520px]">
          <Map
            ref={mapRef}
            center={[20, 20]}
            zoom={1.8}
            minZoom={1.5}
            maxZoom={12}
            theme="dark"
            projection={layers.globe ? { type: "globe" } : { type: "mercator" }}
            className="rounded-lg"
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
                    {" · "}
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
                <p className="text-base font-bold">
                  {formatCurrency(node.revenue)}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {formatNumber(node.orders)} orders ·{" "}
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
                  <p className="text-[10px] text-emerald-500 font-bold">{item.amount}</p>
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
