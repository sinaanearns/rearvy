import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRollingChatSummary,
  buildTurnSummaryBullets,
} from "./chat-summary-memory";
import { redactSensitiveMemoryText } from "@/lib/sensitive-memory";

test("redacts credential-looking values before summary storage", () => {
  const redacted = redactSensitiveMemoryText(
    "Use password=super-secret and api key sk-testsecretsecretsecret123 for login."
  );

  assert.match(redacted, /password: \[REDACTED_SECRET\]/i);
  assert.doesNotMatch(redacted, /super-secret/);
  assert.doesNotMatch(redacted, /sk-testsecret/i);
});

test("builds a rolling summary with new important bullets first", () => {
  const summary = buildRollingChatSummary({
    existingContent: [
      "Rolling chat summary:",
      "- User asked: Build a dashboard for client reporting.",
    ].join("\n"),
    chatTitle: "Client dashboard",
    userText: "Remember that my goal is to make Rearvy better for agencies.",
    assistantText: "Saved that goal and updated the plan.",
  });

  assert.ok(summary);
  assert.match(summary, /Rolling chat summary for "Client dashboard"/);
  assert.match(summary, /User shared: Remember that my goal is to make Rearvy better for agencies/);
  assert.match(summary, /User asked: Build a dashboard for client reporting/);
});

test("adds a safe credential note without keeping the secret", () => {
  const bullets = buildTurnSummaryBullets({
    userText: "The login password: hunter2 should be saved for this website.",
    assistantText: "I cannot store raw passwords in normal memory.",
  });

  assert.ok(
    bullets.some((bullet) => bullet.includes("Raw secrets were not stored"))
  );
  assert.equal(bullets.some((bullet) => bullet.includes("hunter2")), false);
});
