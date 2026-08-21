import assert from "node:assert/strict";
import test from "node:test";
import { OrchestratorPlanSchema } from "./schemas";

test("OrchestratorPlanSchema validates correct plan structure", () => {
  const validPlan = {
    goal: "Draft an email recap of competitor Shopify research",
    assumptions: ["User has Gmail integrated", "Shopify competitor research is available"],
    confidence_score: 0.9,
    summary: "Plan to draft a Shopify recap email",
    estimated_duration_ms: 15000,
    requires_approval: true,
    steps: [
      {
        id: "step_1",
        name: "Research Shopify",
        description: "Search web for Shopify updates",
        type: "web_research",
        input: { query: "Shopify competitor analysis 2026" },
        dependencies: [],
        requiresApproval: false,
      },
      {
        id: "step_2",
        name: "Draft Recap",
        description: "Draft recap of search results to user email",
        type: "email_draft",
        input: { to: "user@example.com", subject: "Shopify Recap" },
        dependencies: ["step_1"],
        requiresApproval: true,
      },
    ],
  };

  const parsed = OrchestratorPlanSchema.safeParse(validPlan);
  assert.ok(parsed.success, "Valid plan failed validation: " + (parsed.success ? "" : parsed.error.message));
});

test("OrchestratorPlanSchema rejects invalid step types", () => {
  const invalidPlan = {
    goal: "Goal",
    assumptions: ["Assumption"],
    confidence_score: 0.5,
    summary: "Summary",
    estimated_duration_ms: 1000,
    requires_approval: false,
    steps: [
      {
        id: "step_1",
        name: "Invalid Step",
        description: "Vague description",
        type: "non_existent_capability_type",
        input: {},
        dependencies: [],
        requiresApproval: false,
      },
    ],
  };

  const parsed = OrchestratorPlanSchema.safeParse(invalidPlan);
  assert.equal(parsed.success, false, "Invalid step type was incorrectly accepted");
});

test("OrchestratorPlanSchema rejects empty assumptions", () => {
  const invalidPlan = {
    goal: "Goal",
    assumptions: [], // Missing required assumptions
    confidence_score: 0.8,
    summary: "Summary",
    estimated_duration_ms: 1000,
    requires_approval: false,
    steps: [
      {
        id: "step_1",
        name: "Step",
        description: "Desc",
        type: "llm_reasoning",
        input: { prompt: "test" },
        dependencies: [],
        requiresApproval: false,
      },
    ],
  };

  const parsed = OrchestratorPlanSchema.safeParse(invalidPlan);
  assert.equal(parsed.success, false, "Empty assumptions array was incorrectly accepted");
});
