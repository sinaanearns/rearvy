import assert from "node:assert/strict";
import test from "node:test";

import {
  buildContentCreationSystemAddition,
  detectContentCreationIntent,
} from "./content-creation.ts";

test("detects creator content requests", () => {
  const intent = detectContentCreationIntent(
    "write a TikTok script about launching my new skincare product"
  );

  assert.equal(intent?.kind, "script");
  assert.equal(intent?.needsCurrentResearch, false);
});

test("flags content requests that need current research", () => {
  const intent = detectContentCreationIntent(
    "create LinkedIn posts about the latest AI marketing trends with stats"
  );

  assert.equal(intent?.kind, "social");
  assert.equal(intent?.needsCurrentResearch, true);
});

test("does not hijack engineering fixes about content generation", () => {
  assert.equal(
    detectContentCreationIntent("fix the content generation bug in the api route"),
    null
  );
});

test("content creation prompt addition forbids unsupported facts", () => {
  const addition = buildContentCreationSystemAddition({
    kind: "social",
    needsCurrentResearch: true,
  });

  assert.match(addition, /Never fabricate brand facts/);
  assert.match(addition, /\[NEEDS: source\/current data\]/);
  assert.match(addition, /publish-ready copy/);
});
