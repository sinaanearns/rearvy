"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BaseMap } from "@/components/maps/base-map";
import type { MapVisualizationPayload } from "@/lib/maps/map-types";
import { cn } from "@/lib/utils";

interface TradingMapCardProps {
  data: MapVisualizationPayload;
}

const MARKER_TONE_STYLES: Record<NonNullable<MapVisualizationPayload["markers"][number]["tone"]>, string> = {
  neutral: "bg-slate-400/20 text-slate-700 dark:text-slate-200 border-slate-400/30",
  blue: "bg-sky-500/15 text-sky-700 dark:text-sky-200 border-sky-500/25",
  emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-200 border-emerald-500/25",
  amber: "bg-amber-500/15 text-amber-700 dark:text-amber-200 border-amber-500/25",
  rose: "bg-rose-500/15 text-rose-700 dark:text-rose-200 border-rose-500/25",
  violet: "bg-violet-500/15 text-violet-700 dark:text-violet-200 border-violet-500/25",
};

function formatCenter(center: [number, number]): string {
  return `${center[1].toFixed(2)}, ${center[0].toFixed(2)}`;
}

export default function TradingMapCard({ data }: TradingMapCardProps) {
  const topMarkers = data.markers.slice(0, 4);
  const markerOverflow = Math.max(data.markers.length - topMarkers.length, 0);

  return (
    <Card className="w-full max-w-full overflow-hidden border-border/70 bg-card shadow-sm">
      <CardHeader className="gap-2 border-b border-border/70 bg-gradient-to-r from-slate-950 via-slate-900 to-background px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base font-semibold text-foreground">
              {data.title}
            </CardTitle>
            {data.summary ? (
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                {data.summary}
              </CardDescription>
            ) : (
              <CardDescription className="mt-1 text-sm text-muted-foreground">
                AI-generated geographic context for the current trading brief.
              </CardDescription>
            )}
          </div>

          <div className="rounded-full border border-border/70 bg-background/80 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
            Interactive map
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 px-4 py-4">
        <BaseMap
          viewport={data.viewport}
          markers={data.markers}
          routes={data.routes}
          className="h-[280px] sm:h-[340px]"
        />

        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
            {data.markers.length} markers
          </span>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
            {data.routes.length} routes
          </span>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
            Center {formatCenter(data.viewport.center)}
          </span>
          <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
            Zoom {data.viewport.zoom.toFixed(2)}
          </span>
          {data.metadata.focus ? (
            <span className="rounded-full border border-border/70 bg-muted/40 px-3 py-1">
              Focus {data.metadata.focus}
            </span>
          ) : null}
        </div>

        {topMarkers.length > 0 && (
          <div className="grid gap-2 sm:grid-cols-2">
            {topMarkers.map((marker) => (
              <div
                key={marker.id}
                className="rounded-xl border border-border/70 bg-muted/20 px-3 py-2"
              >
                <div className="flex items-start gap-2">
                  <span
                    className={cn(
                      "mt-1 size-2.5 rounded-full border border-background",
                      MARKER_TONE_STYLES[marker.tone ?? "blue"]
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {marker.label}
                    </p>
                    {marker.description ? (
                      <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                        {marker.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
            {markerOverflow > 0 ? (
              <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 px-3 py-2 text-xs text-muted-foreground sm:col-span-2">
                +{markerOverflow} more locations are plotted on the map.
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}