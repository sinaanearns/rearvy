import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coerceMariaActionPlan } from "./action-plan";

describe("coerceMariaActionPlan", () => {
  it("coerces a click plan and clamps numeric fields", () => {
    assert.deepEqual(
      coerceMariaActionPlan(
        '{"action":"click","label":" Continue ","reason":" Proceed safely ","x":1.4,"y":-0.2,"confidence":2,"risk":"high"}'
      ),
      {
        action: "click",
        label: "Continue",
        reason: "Proceed safely",
        x: 1,
        y: 0,
        confidence: 1,
        risk: "high",
      }
    );
  });

  it("extracts the first balanced JSON object without swallowing trailing braces", () => {
    assert.deepEqual(
      coerceMariaActionPlan(
        'Plan: {"action":"click","label":"Search {field}","reason":"Focus the field","x":0.25,"y":0.75,"confidence":0.8,"risk":"low"} trailing {not json}'
      ),
      {
        action: "click",
        label: "Search {field}",
        reason: "Focus the field",
        x: 0.25,
        y: 0.75,
        confidence: 0.8,
        risk: "low",
      }
    );
  });

  it("returns a safe none plan for non-click actions", () => {
    assert.deepEqual(
      coerceMariaActionPlan(
        '{"action":"none","label":"No target","reason":"Needs user choice","confidence":0.6,"risk":"medium"}'
      ),
      {
        action: "none",
        label: "No target",
        reason: "Needs user choice",
        confidence: 0.6,
        risk: "medium",
      }
    );
  });

  it("falls back when JSON or click coordinates are unusable", () => {
    assert.equal(coerceMariaActionPlan("not json").action, "none");
    assert.deepEqual(coerceMariaActionPlan('{"action":"click"}'), {
      action: "none",
      label: "No safe action",
      reason: "The action plan did not include usable screen coordinates.",
      confidence: 0,
      risk: "medium",
    });
  });
});
