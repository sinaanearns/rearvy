"use client";

import {
  Map,
  MapControls,
  MapMarker,
  MapRoute,
  MarkerContent,
  MarkerLabel,
  MarkerTooltip,
} from "@/components/ui/map";
import { cn } from "@/lib/utils";
import type {
  MapMarkerDatum,
  MapRouteDatum,
  MapViewport,
} from "@/lib/maps/map-types";

type BaseMapProps = {
  viewport: MapViewport;
  markers?: MapMarkerDatum[];
  routes?: MapRouteDatum[];
  className?: string;
  showControls?: boolean;
};

const MARKER_TONE_CLASSES: Record<NonNullable<MapMarkerDatum["tone"]>, string> = {
  neutral: "bg-slate-200",
  blue: "bg-sky-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-400",
  rose: "bg-rose-500",
  violet: "bg-violet-500",
};

export function BaseMap({
  viewport,
  markers = [],
  routes = [],
  className,
  showControls = true,
}: BaseMapProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[8px] border border-border/70 bg-background",
        className
      )}
    >
      <Map viewport={viewport} className="h-full w-full">
        {routes.map((route) => (
          <MapRoute
            key={route.id}
            id={route.id}
            coordinates={route.coordinates}
            color={route.color}
            width={route.width}
            opacity={route.opacity}
            dashArray={route.dashed ? [4, 4] : undefined}
          />
        ))}

        {markers.map((marker) => (
          <MapMarker
            key={marker.id}
            longitude={marker.longitude}
            latitude={marker.latitude}
          >
            <MarkerContent className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  "size-3 rounded-full border-2 border-background shadow-lg",
                  marker.emphasis ? "scale-125" : "",
                  MARKER_TONE_CLASSES[marker.tone ?? "blue"]
                )}
              />
              <MarkerLabel className="rounded-[8px] border border-border/70 bg-background/90 px-2 py-0.5 text-[10px] font-medium text-foreground shadow-sm backdrop-blur">
                {marker.label}
              </MarkerLabel>
            </MarkerContent>
            <MarkerTooltip className="max-w-56">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-foreground">
                  {marker.label}
                </p>
                {marker.description && (
                  <p className="text-[11px] leading-relaxed text-muted-foreground">
                    {marker.description}
                  </p>
                )}
                <p className="text-[11px] font-medium text-muted-foreground/80">
                  Coordinates {marker.latitude.toFixed(4)}, {marker.longitude.toFixed(4)}
                </p>
              </div>
            </MarkerTooltip>
          </MapMarker>
        ))}

        {showControls && (
          <MapControls position="top-right" showZoom showCompass={false} showLocate={false} showFullscreen={false} />
        )}
      </Map>
    </div>
  );
}
