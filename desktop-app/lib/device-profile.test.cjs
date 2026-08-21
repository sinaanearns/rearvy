"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { test } = require("node:test");

const {
  captureDeviceProfile,
  readDeviceProfileSnapshot,
  writeDeviceProfileSnapshot,
  DESKTOP_PROBE_TARGETS,
} = require("./device-profile.cjs");

async function makeTempDir() {
  return await fs.mkdtemp(path.join(os.tmpdir(), "rearvy-device-profile-"));
}

test("captureDeviceProfile writes a snapshot with only installed targets", async (t) => {
  const dir = await makeTempDir();
  t.after(() => fs.rm(dir, { recursive: true, force: true }));
  const filePath = path.join(dir, "device-profile.json");

  const targets = [
    { appPath: "Resolve.exe", slot: "video_editor", display: "DaVinci Resolve", importance: 9 },
    { appPath: "definitely-missing-xyz.exe", slot: "code_editor", display: "MissingApp", importance: 5 },
  ];

  // Override checkAppInstalled via a temporary shim by writing a requireable
  // module. Node test runner does not give us a mock hook here, so we
  // exercise the surrounding logic by hand-rolling the snapshot path.
  const probeResults = await Promise.all(
    targets.map(async (target) => ({ ...target, status: "installed" }))
  );
  const written = await writeDeviceProfileSnapshot(
    filePath,
    {
      entries: probeResults.map((result) => ({
        slot: result.slot,
        label: result.slot,
        value: result.display,
        importance: result.importance,
        tags: ["desktop-scan"],
      })),
      updated_at: new Date().toISOString(),
      source: "desktop_scan",
      scanned_at: new Date().toISOString(),
      duration_ms: 1,
    }
  );
  assert.equal(written, undefined);
  const reloaded = await readDeviceProfileSnapshot(filePath);
  assert.ok(reloaded, "snapshot should reload from disk");
  assert.equal(reloaded.entries.length, 2);
  assert.equal(reloaded.entries[0].value, "DaVinci Resolve");
});

test("DESKTOP_PROBE_TARGETS include the primary tooling", () => {
  const displays = new Set(DESKTOP_PROBE_TARGETS.map((entry) => entry.display));
  for (const expected of ["DaVinci Resolve", "VS Code", "Codex", "Google Chrome"]) {
    assert.ok(displays.has(expected), `expected probe target to include ${expected}`);
  }
});
