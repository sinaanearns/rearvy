import assert from "node:assert/strict";
import test from "node:test";
import { copyTextToClipboard } from "./clipboard";

test("copyTextToClipboard prefers the Electron clipboard bridge", async () => {
  const originalWindow = globalThis.window;
  const originalNavigator = globalThis.navigator;
  const copied: string[] = [];

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { electron: { clipboard: { writeText: async (text: string) => copied.push(text) } } },
  });
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: { clipboard: { writeText: async () => assert.fail("browser clipboard should not run") } },
  });

  try {
    await copyTextToClipboard("Rearvy report");
    assert.deepEqual(copied, ["Rearvy report"]);
  } finally {
    Object.defineProperty(globalThis, "window", { configurable: true, value: originalWindow });
    Object.defineProperty(globalThis, "navigator", { configurable: true, value: originalNavigator });
  }
});
