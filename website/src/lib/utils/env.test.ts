import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { isElectron } from "./env";

type TestWindow = {
  __electronReady?: boolean;
  electron?: unknown;
  navigator: {
    userAgent: string;
  };
};

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function setTestWindow(windowValue: TestWindow) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: windowValue,
  });
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

test("detects Electron from the browser user agent", () => {
  setTestWindow({
    navigator: {
      userAgent: "Mozilla/5.0 Electron/41.3.0 Chrome/140.0.0.0",
    },
  });

  assert.equal(isElectron(), true);
});

test("detects Electron from the preload bridge", () => {
  setTestWindow({
    electron: {},
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0",
    },
  });

  assert.equal(isElectron(), true);
});

test("detects Electron from the preload ready marker", () => {
  setTestWindow({
    __electronReady: true,
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0",
    },
  });

  assert.equal(isElectron(), true);
});

test("does not classify a normal browser as Electron", () => {
  setTestWindow({
    navigator: {
      userAgent: "Mozilla/5.0 Chrome/140.0.0.0",
    },
  });

  assert.equal(isElectron(), false);
});
