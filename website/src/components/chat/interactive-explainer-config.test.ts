import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_INTERACTIVE_EXPLAINER_CONFIG,
  normalizeInteractiveExplainerConfig,
} from "./interactive-explainer-config.ts";

test("normalizeInteractiveExplainerConfig falls back for malformed config", () => {
  assert.deepEqual(
    normalizeInteractiveExplainerConfig("not json"),
    DEFAULT_INTERACTIVE_EXPLAINER_CONFIG
  );
  assert.deepEqual(
    normalizeInteractiveExplainerConfig("[]"),
    DEFAULT_INTERACTIVE_EXPLAINER_CONFIG
  );
});

test("normalizeInteractiveExplainerConfig cleans text and accepts numeric strings", () => {
  const config = normalizeInteractiveExplainerConfig(
    JSON.stringify({
      title: " ROI\nPlanner ",
      subtitle: " Compare\toutcomes ",
      principal: "25000",
      rate: "12.5",
      years: "5",
      principalRange: { min: "5000", max: "100000", step: "2500" },
      rateRange: { min: "2", max: "20", step: "0.25" },
      yearsRange: { min: "2", max: "12", step: "1" },
    })
  );

  assert.deepEqual(config, {
    title: "ROI Planner",
    subtitle: "Compare outcomes",
    principal: 25000,
    rate: 12.5,
    years: 5,
    principalRange: { min: 5000, max: 100000, step: 2500 },
    rateRange: { min: 2, max: 20, step: 0.25 },
    yearsRange: { min: 2, max: 12, step: 1 },
  });
});

test("normalizeInteractiveExplainerConfig clamps extreme generated ranges", () => {
  const config = normalizeInteractiveExplainerConfig(
    JSON.stringify({
      principal: 999999999,
      rate: -1,
      years: 1000,
      principalRange: { min: -100, max: 1000000000, step: 2000000 },
      rateRange: { min: -5, max: 500, step: 50 },
      yearsRange: { min: 0, max: 1000, step: 100 },
    })
  );

  assert.deepEqual(config.principalRange, {
    min: 1,
    max: 10000000,
    step: 1000000,
  });
  assert.deepEqual(config.rateRange, { min: 0, max: 100, step: 10 });
  assert.deepEqual(config.yearsRange, { min: 1, max: 100, step: 10 });
  assert.equal(config.principal, 10000000);
  assert.equal(config.rate, 0);
  assert.equal(config.years, 100);
});

test("normalizeInteractiveExplainerConfig sorts inverted ranges", () => {
  const config = normalizeInteractiveExplainerConfig(
    JSON.stringify({
      principal: 500,
      principalRange: { min: 1000, max: 100, step: 50 },
    })
  );

  assert.deepEqual(config.principalRange, { min: 100, max: 1000, step: 50 });
  assert.equal(config.principal, 500);
});
