import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDesktopLaunchIntentFromTarget,
  buildDesktopLaunchWorkflow,
  detectDesktopLaunchFollowUpIntent,
  detectDesktopLaunchIntent,
  isDesktopLaunchRepeatRequest,
} from "./desktop-launch-intent";

test("detects default browser launch requests", () => {
  const intent = detectDesktopLaunchIntent("i want you to open browser");

  assert.equal(intent?.kind, "browser");
  assert.equal(intent?.label, "default browser");
  assert.deepEqual(intent?.action, {
    type: "openPath",
    target: "https://www.google.com",
    wait: true,
  });
});

test("detects named browser and app launch requests", () => {
  const chrome = detectDesktopLaunchIntent("open Chrome");
  const spotify = detectDesktopLaunchIntent("launch Spotify app");
  const photoshop = detectDesktopLaunchIntent("open Photoshop from desktop");
  const accio = detectDesktopLaunchIntent("open Accio in my desktop");
  const antigravity = detectDesktopLaunchIntent("open antigravity desktop app");
  const misspelledAntigravity = detectDesktopLaunchIntent("open atigravity");

  assert.equal(chrome?.kind, "browser");
  assert.deepEqual(chrome?.action, {
    type: "launchApp",
    appPath: "chrome.exe",
    wait: true,
  });

  assert.equal(spotify?.kind, "app");
  assert.deepEqual(spotify?.action, {
    type: "launchApp",
    appPath: "Spotify",
    wait: true,
  });

  assert.equal(photoshop?.kind, "app");
  assert.deepEqual(photoshop?.action, {
    type: "launchApp",
    appPath: "Photoshop",
    wait: true,
  });

  assert.equal(accio?.kind, "app");
  assert.equal(accio?.label, "Accio");
  assert.deepEqual(accio?.action, {
    type: "launchApp",
    appPath: "Accio",
    wait: true,
  });

  assert.equal(antigravity?.kind, "app");
  assert.deepEqual(antigravity?.action, {
    type: "launchApp",
    appPath: "Antigravity",
    wait: true,
  });

  assert.equal(misspelledAntigravity?.kind, "app");
  assert.deepEqual(misspelledAntigravity?.action, {
    type: "launchApp",
    appPath: "Antigravity",
    wait: true,
  });
});

test("builds approval workflow payload for desktop launch intent", () => {
  const intent = detectDesktopLaunchIntent("open notepad");
  assert.ok(intent);

  const workflow = buildDesktopLaunchWorkflow(intent);

  assert.equal(workflow.name, "Open Notepad");
  assert.equal(workflow.steps.length, 1);
  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.equal(workflow.steps[0]?.timeout, 20000);
});

test("does not treat arbitrary open requests as app launches", () => {
  assert.equal(detectDesktopLaunchIntent("open the latest sales report"), null);
  assert.equal(detectDesktopLaunchIntent("run terminal command: dir"), null);
});

test("detects app-name follow-up after a launch request", () => {
  const intent = detectDesktopLaunchFollowUpIntent(
    "open Accio in my desktop",
    "Accio app"
  );

  assert.equal(intent?.kind, "app");
  assert.equal(intent?.label, "Accio");
  assert.deepEqual(intent?.action, {
    type: "launchApp",
    appPath: "Accio",
    wait: true,
  });

  assert.equal(
    detectDesktopLaunchFollowUpIntent("what is Accio?", "Accio app"),
    null
  );
});

test("detects repeat launch requests without treating again as a target", () => {
  assert.equal(isDesktopLaunchRepeatRequest("open again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("open it again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("launch the same again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("open Gmail"), false);

  const intent = buildDesktopLaunchIntentFromTarget("Lenovo Vantage");
  assert.equal(intent?.kind, "app");
  assert.equal(intent?.label, "Lenovo Vantage");
  assert.deepEqual(intent?.action, {
    type: "launchApp",
    appPath: "Lenovo Vantage",
    wait: true,
  });
});
