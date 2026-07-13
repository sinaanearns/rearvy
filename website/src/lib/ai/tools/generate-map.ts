import { tool } from "ai";
import { z } from "zod";

import type { ToolContext } from "../types";
import {
  MAP_MARKER_TONES,
  averageMapCoordinate,
  deriveMapZoom,
} from "@/lib/maps/map-types";

const mapPointSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().max(180).optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  tone: z.enum(MAP_MARKER_TONES).optional(),
  emphasis: z.boolean().optional(),
});

const mapRoutePointSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

const mapRouteSchema = z.object({
  id: z.string().trim().optional(),
  label: z.string().trim().max(80).optional(),
  color: z.string().trim().optional(),
  width: z.number().min(1).max(12).optional(),
  opacity: z.number().min(0).max(1).optional(),
  dashed: z.boolean().optional(),
  points: z.array(mapRoutePointSchema).min(2),
});

const mapViewportSchema = z.object({
  center: z
    .object({
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
    })
    .optional(),
  zoom: z.number().min(0).max(22).optional(),
  bearing: z.number().min(-180).max(180).optional(),
  pitch: z.number().min(0).max(85).optional(),
});

export const generateMapInputSchema = z
  .object({
    title: z.string().trim().min(1).max(80).default("Map visualization"),
    summary: z.string().trim().max(280).optional(),
    focus: z.string().trim().max(120).optional(),
    viewport: mapViewportSchema.optional(),
    markers: z.array(mapPointSchema).max(50).default([]),
    routes: z.array(mapRouteSchema).max(12).default([]),
  })
  .superRefine((value, ctx) => {
    if (
      value.markers.length === 0 &&
      value.routes.length === 0 &&
      !value.viewport?.center
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Provide at least one marker, route, or viewport center for the map.",
      });
    }
  });

export const generateMapOutputSchema = z.object({
  kind: z.literal("map"),
  title: z.string(),
  summary: z.string().optional(),
  viewport: z.object({
    center: z.tuple([z.number(), z.number()]),
    zoom: z.number(),
    bearing: z.number().optional(),
    pitch: z.number().optional(),
  }),
  markers: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
      latitude: z.number(),
      longitude: z.number(),
      tone: z.enum(MAP_MARKER_TONES).optional(),
      emphasis: z.boolean().optional(),
    })
  ),
  routes: z.array(
    z.object({
      id: z.string(),
      label: z.string().optional(),
      color: z.string().optional(),
      width: z.number().optional(),
      opacity: z.number().optional(),
      dashed: z.boolean().optional(),
      coordinates: z.array(z.tuple([z.number(), z.number()])),
    })
  ),
  metadata: z.object({
    generatedAt: z.number(),
    focus: z.string().optional(),
  }),
});

export type GenerateMapInput = z.infer<typeof generateMapInputSchema>;
export type GenerateMapOutput = z.infer<typeof generateMapOutputSchema>;

const ROUTE_COLORS = [
  "#2563eb",
  "#0f766e",
  "#b45309",
  "#be123c",
  "#7c3aed",
  "#0e7490",
];

function buildRouteColor(index: number): string {
  return ROUTE_COLORS[index % ROUTE_COLORS.length];
}

function normalizeRoutes(input: GenerateMapInput["routes"]) {
  return input.map((route, index) => ({
    id: route.id?.trim() || `route-${index + 1}`,
    label: route.label,
    color: route.color || buildRouteColor(index),
    width: route.width ?? 3,
    opacity: route.opacity ?? 0.85,
    dashed: route.dashed ?? false,
    coordinates: route.points.map(
      (point) => [point.longitude, point.latitude] as [number, number]
    ),
  }));
}

function resolveCenter(
  input: GenerateMapInput,
  markers: GenerateMapOutput["markers"],
  routes: GenerateMapOutput["routes"]
): [number, number] {
  const configuredCenter = input.viewport?.center;
  if (configuredCenter) {
    return [configuredCenter.longitude, configuredCenter.latitude];
  }

  const points = [
    ...markers.map((marker) => ({
      latitude: marker.latitude,
      longitude: marker.longitude,
    })),
    ...routes.flatMap((route) =>
      route.coordinates.map(([longitude, latitude]) => ({
        latitude,
        longitude,
      }))
    ),
  ];

  const average = averageMapCoordinate(points);
  if (average) {
    return [average.longitude, average.latitude];
  }

  return [0, 0];
}

export function normalizeGeneratedMapPayload(
  input: GenerateMapInput
): GenerateMapOutput {
  const markers = input.markers.map((marker, index) => ({
    id: marker.id?.trim() || `marker-${index + 1}`,
    label: marker.label,
    description: marker.description,
    latitude: marker.latitude,
    longitude: marker.longitude,
    tone: marker.tone,
    emphasis: marker.emphasis,
  }));

  const routes = normalizeRoutes(input.routes);
  const center = resolveCenter(input, markers, routes);
  const pointCount = markers.length + routes.reduce((sum, route) => sum + route.coordinates.length, 0);

  return generateMapOutputSchema.parse({
    kind: "map",
    title: input.title,
    summary: input.summary || input.focus,
    viewport: {
      center,
      zoom: input.viewport?.zoom ?? deriveMapZoom(pointCount),
      bearing: input.viewport?.bearing ?? 0,
      pitch: input.viewport?.pitch ?? 0,
    },
    markers,
    routes,
    metadata: {
      generatedAt: Date.now(),
      focus: input.focus,
    },
  });
}

export function generateMap(ctx: ToolContext) {
  void ctx;

  return tool({
    description:
      "Generate a chat-ready map visualization payload with markers, routes, and viewport metadata.",
    inputSchema: generateMapInputSchema,
    execute: async (input) => normalizeGeneratedMapPayload(input),
  });
}