import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeMariaReadiness } from "./readiness";

test("summarizes a fully ready Maria bridge", () => {
  const summary = summarizeMariaReadiness({
    ok: true,
    bridge: { mainWindow: true, overlayWindow: true },
    shortcuts: {
      dictation: { registered: true },
      command: { registered: true },
    },
    issues: [],
  });

  assert.equal(summary.isReady, true);
  assert.equal(summary.status, "Ready");
  assert.equal(summary.note, "Maria is ready near your cursor.");
});

test("summarizes a missing desktop bridge", () => {
  const summary = summarizeMariaReadiness(null);

  assert.equal(summary.isReady, false);
  assert.equal(summary.status, "Desktop bridge unavailable");
  assert.match(summary.note, /desktop app/i);
});

test("surfaces shortcut registration issues", () => {
  const issue = "Maria screen shortcut is unavailable; another app may be using it.";
  const summary = summarizeMariaReadiness({
    ok: false,
    bridge: { mainWindow: true, overlayWindow: true },
    shortcuts: {
      dictation: { registered: true },
      command: { registered: false },
    },
    issues: [issue],
  });

  assert.equal(summary.isReady, false);
  assert.equal(summary.status, "Needs setup");
  assert.equal(summary.note, issue);
});
