import test from "node:test";
import assert from "node:assert/strict";

import { DESKTOP_PROBE_TARGETS, describeDesktopProbeResult } from "./desktop";

test("desktop probe catalog includes the user's primary tooling", () => {
  const targets = new Set(DESKTOP_PROBE_TARGETS.map((entry) => entry.display));
  for (const expected of ["DaVinci Resolve", "VS Code", "Codex"]) {
    assert.ok(targets.has(expected), `expected probe target to include ${expected}`);
  }
});

test("describeDesktopProbeResult returns null for missing apps", () => {
  const sample = DESKTOP_PROBE_TARGETS[0];
  assert.equal(
    describeDesktopProbeResult({
      appPath: sample.appPath,
      display: sample.display,
      status: "missing",
      slot: sample.slot,
      importance: sample.importance,
    }),
    null
  );
});

test("describeDesktopProbeResult returns the display name when installed", () => {
  const sample = DESKTOP_PROBE_TARGETS[0];
  assert.equal(
    describeDesktopProbeResult({
      appPath: sample.appPath,
      display: sample.display,
      status: "installed",
      slot: sample.slot,
      importance: sample.importance,
    }),
    sample.display
  );
});
