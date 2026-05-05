export const MAP_MARKER_TONES = [
  "neutral",
  "blue",
  "emerald",
  "amber",
  "rose",
  "violet",
] as const;

export type MapMarkerTone = (typeof MAP_MARKER_TONES)[number];

export type MapCoordinate = {
  latitude: number;
  longitude: number;
};

export type MapMarkerDatum = MapCoordinate & {
  id: string;
  label: string;
  description?: string;
  tone?: MapMarkerTone;
  emphasis?: boolean;
};

export type MapRouteDatum = {
  id: string;
  label?: string;
  color?: string;
  width?: number;
  opacity?: number;
  dashed?: boolean;
  coordinates: [number, number][];
};

export type MapViewport = {
  center: [number, number];
  zoom: number;
  bearing?: number;
  pitch?: number;
};

export type MapVisualizationPayload = {
  kind: "map";
  title: string;
  summary?: string;
  viewport: MapViewport;
  markers: MapMarkerDatum[];
  routes: MapRouteDatum[];
  metadata: {
    generatedAt: number;
    focus?: string;
  };
};

export function averageMapCoordinate(
  points: MapCoordinate[]
): MapCoordinate | null {
  if (points.length === 0) {
    return null;
  }

  const totals = points.reduce(
    (accumulator, point) => ({
      latitude: accumulator.latitude + point.latitude,
      longitude: accumulator.longitude + point.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: totals.latitude / points.length,
    longitude: totals.longitude / points.length,
  };
}

export function deriveMapZoom(pointCount: number): number {
  if (pointCount <= 0) {
    return 2;
  }

  if (pointCount === 1) {
    return 6;
  }

  if (pointCount <= 4) {
    return 4.25;
  }

  if (pointCount <= 10) {
    return 3.25;
  }

  return 2.5;
}