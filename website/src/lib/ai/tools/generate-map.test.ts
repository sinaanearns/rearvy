import assert from "node:assert/strict";
import test from "node:test";

import {
  generateMapInputSchema,
  generateMapOutputSchema,
  normalizeGeneratedMapPayload,
} from "./generate-map";

test("generate map schema accepts valid coordinates and route points", () => {
  const parsed = generateMapInputSchema.parse({
    title: "Semiconductor Risk Map",
    summary: "Major fabs and shipping chokepoints in East Asia.",
    markers: [
      {
        label: "Taiwan Semiconductor Park",
        latitude: 24.141,
        longitude: 120.672,
        tone: "emerald",
      },
    ],
    routes: [
      {
        label: "Shipping corridor",
        points: [
          { latitude: 25.033, longitude: 121.5654 },
          { latitude: 22.6273, longitude: 120.3014 },
        ],
      },
    ],
  });

  assert.equal(parsed.title, "Semiconductor Risk Map");
  assert.equal(parsed.markers.length, 1);
  assert.equal(parsed.routes.length, 1);
});

test("generate map schema rejects invalid coordinates", () => {
  const result = generateMapInputSchema.safeParse({
    title: "Invalid Map",
    markers: [
      {
        label: "Broken point",
        latitude: 120,
        longitude: 10,
      },
    ],
  });

  assert.equal(result.success, false);
});

test("normalized map payload derives a viewport and passes output validation", () => {
  const input = generateMapInputSchema.parse({
    title: "BOJ Watch",
    focus: "Central bank move",
    markers: [
      {
        label: "Tokyo",
        latitude: 35.6762,
        longitude: 139.6503,
      },
    ],
  });

  const payload = normalizeGeneratedMapPayload(input);

  assert.deepEqual(payload.viewport.center, [139.6503, 35.6762]);
  assert.equal(payload.viewport.zoom, 6);
  assert.equal(payload.kind, "map");
  assert.equal(generateMapOutputSchema.safeParse(payload).success, true);
});