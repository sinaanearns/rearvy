import test from "node:test";
import assert from "node:assert/strict";

import { normalizeClaudeCardsConfig } from "./claude-cards-config.ts";

test("normalizeClaudeCardsConfig rejects malformed or non-object config", () => {
  assert.deepEqual(normalizeClaudeCardsConfig("not json"), {});
  assert.deepEqual(normalizeClaudeCardsConfig("[]"), {});
  assert.deepEqual(normalizeClaudeCardsConfig("null"), {});
});

test("normalizeClaudeCardsConfig cleans text fields and keeps valid cards", () => {
  const config = normalizeClaudeCardsConfig(
    JSON.stringify({
      title: " KPI\nSnapshot ",
      subtitle: "  Fast\tcomparison  ",
      cards: [
        {
          label: " Revenue\nGrowth ",
          value: " +18%\tYoY ",
          benchmark: " 12% median ",
          note: " Stronger than peer\nset ",
          delta: " +6pp ",
          tone: "good",
        },
      ],
    })
  );

  assert.deepEqual(config, {
    title: "KPI Snapshot",
    subtitle: "Fast comparison",
    cards: [
      {
        label: "Revenue Growth",
        value: "+18% YoY",
        benchmark: "12% median",
        note: "Stronger than peer set",
        delta: "+6pp",
        tone: "good",
      },
    ],
  });
});

test("normalizeClaudeCardsConfig drops malformed cards and unsafe sparkline points", () => {
  const config = normalizeClaudeCardsConfig(
    JSON.stringify({
      cards: [
        { label: "Valid", value: 12, tone: "accent", sparkline: [1, -1, 2, Number.NaN, 3, Infinity] },
        { label: "   ", value: "missing label" },
        "not a card",
        { label: "Bad tone", tone: "great", sparkline: [-1, Number.NaN] },
      ],
    })
  );

  assert.deepEqual(config.cards, [
    {
      label: "Valid",
      value: 12,
      tone: "accent",
      sparkline: [1, 2, 3],
    },
    {
      label: "Bad tone",
    },
  ]);
});

test("normalizeClaudeCardsConfig caps card count", () => {
  const cards = Array.from({ length: 12 }, (_, index) => ({
    label: `Card ${index + 1}`,
  }));

  const config = normalizeClaudeCardsConfig(JSON.stringify({ cards }));

  assert.equal(config.cards?.length, 9);
  assert.equal(config.cards?.[8]?.label, "Card 9");
});
