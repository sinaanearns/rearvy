import assert from "node:assert/strict";
import test from "node:test";

import { getWeatherSummary } from "./context";

test("getWeatherSummary skips lookup without coordinates", async () => {
  assert.deepEqual(
    await getWeatherSummary({
      city: null,
      region: null,
      country: null,
      latitude: null,
      longitude: null,
    }),
    {
      status: "unavailable",
      reason: "Approximate latitude and longitude were not available from request headers.",
    }
  );
});

test("getWeatherSummary returns current weather records", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () =>
    new Response(
      JSON.stringify({
        current: {
          temperature_2m: 29,
          relative_humidity_2m: 61,
        },
      }),
      { status: 200 }
    );

  assert.deepEqual(
    await getWeatherSummary({
      city: "Mumbai",
      region: "Maharashtra",
      country: "IN",
      latitude: 19.07,
      longitude: 72.87,
    }),
    {
      status: "available",
      provider: "open-meteo",
      current: {
        temperature_2m: 29,
        relative_humidity_2m: 61,
      },
    }
  );
});

test("getWeatherSummary handles provider failures", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response("failed", { status: 503 });

  assert.deepEqual(
    await getWeatherSummary({
      city: "Mumbai",
      region: "Maharashtra",
      country: "IN",
      latitude: 19.07,
      longitude: 72.87,
    }),
    { status: "unavailable", reason: "Weather provider request failed." }
  );
});

test("getWeatherSummary falls back for malformed provider JSON", async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async () => new Response("not-json", { status: 200 });

  assert.deepEqual(
    await getWeatherSummary({
      city: "Mumbai",
      region: "Maharashtra",
      country: "IN",
      latitude: 19.07,
      longitude: 72.87,
    }),
    {
      status: "available",
      provider: "open-meteo",
      current: null,
    }
  );
});
