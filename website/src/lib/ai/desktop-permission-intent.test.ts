import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWindowsMicrophonePermissionWorkflow,
  detectDesktopPermissionIntent,
} from "./desktop-permission-intent.ts";

test("detects microphone permission requests", () => {
  const prompts = [
    "the issue is with microphone fix it",
    "give access",
    "allow mic",
    "microphone permission needed",
    "Could not capture audio. Check microphone permissions and try again.",
  ];

  for (const prompt of prompts) {
    assert.deepEqual(detectDesktopPermissionIntent(prompt), {
      kind: "microphone",
    });
  }
});

test("does not treat business data access as microphone permission", () => {
  const prompts = [
    "access my Shopify analytics",
    "give access to revenue data",
    "grant access to my Gmail account",
    "can you access YouTube orders",
  ];

  for (const prompt of prompts) {
    assert.equal(detectDesktopPermissionIntent(prompt), null);
  }
});

test("does not treat device control requests as microphone permission", () => {
  const prompts = [
    "give Rearvy full access to my device and mouse",
    "allow the AI to take screenshots, click, and type",
    "grant 100% desktop control",
  ];

  for (const prompt of prompts) {
    assert.equal(detectDesktopPermissionIntent(prompt), null);
  }
});

test("builds a Windows microphone permission workflow", () => {
  const workflow = buildWindowsMicrophonePermissionWorkflow();

  assert.equal(workflow.name, "Open microphone privacy settings");
  assert.equal(workflow.steps.length, 3);
  assert.deepEqual(workflow.steps[0].action, {
    type: "launchApp",
    appPath: "explorer.exe",
    args: ["ms-settings:privacy-microphone"],
    wait: true,
  });
  assert.equal(workflow.steps[2].action.type, "screenshot");
});
