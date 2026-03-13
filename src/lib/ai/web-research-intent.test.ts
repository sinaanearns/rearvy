import assert from "node:assert/strict";
import test from "node:test";
import {
  detectWebResearchIntent,
  planWebResearch,
} from "./web-research-intent.ts";

test("detects free-tier web research prompts that previously slipped through", () => {
  const prompts = [
    "acsees web and find my competition",
    "access web and find my competition",
    "research my competition",
    "find my competitors",
    "who are my competitors in shopify analytics",
  ];

  for (const prompt of prompts) {
    assert.equal(detectWebResearchIntent(prompt), true, prompt);
  }
});

test("asks a short follow-up when the user asks for web search without a topic", () => {
  const plan = planWebResearch({
    userText: "can u search web for me",
  });

  assert.equal(plan.intentMatched, true);
  assert.equal(plan.mode, "clarify");
  assert.equal(plan.candidateQueries.length, 0);
  assert.ok(plan.clarificationQuestion);
});

test("builds niche competitor queries from stored business context", () => {
  const plan = planWebResearch({
    userText: "find my competition",
    profile: {
      businessName: "Rearvy",
      businessType: "shopify",
    },
    project: {
      name: "Rearvy AI",
      description: "AI-driven business analysis platform for ecommerce stores",
    },
    memories: [
      {
        content:
          "User is building an AI e-commerce analysis platform for Shopify stores.",
      },
    ],
  });

  assert.equal(plan.intentMatched, true);
  assert.equal(plan.mode, "search");
  assert.ok(plan.candidateQueries.length > 0);
  assert.ok(
    plan.candidateQueries.some(
      (query) =>
        query.includes("shopify") ||
        query.includes("ecommerce") ||
        query.includes("analytics")
    )
  );
  assert.ok(
    plan.candidateQueries.every(
      (query) => !query.includes("find my competition")
    )
  );
  assert.ok(plan.candidateQueries.every((query) => !query.includes("2024")));
});

test("uses the explicit niche when the user names it", () => {
  const plan = planWebResearch({
    userText: "who are my competitors in shopify analytics",
  });

  assert.equal(plan.mode, "search");
  assert.equal(plan.candidateQueries[0], "shopify analytics competitors");
});
