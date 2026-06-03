import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { isScreenReadIntent, normalizeScreenIntentText } from "./screen-intent.ts";

type ScreenIntentModule = {
  isScreenReadIntent: (value: string | null | undefined) => boolean;
  normalizeScreenIntentText: (value: string | null | undefined) => string;
};

const require = createRequire(import.meta.url);
const desktopScreenIntent = require("../../../desktop-app/lib/screen-intent.cjs") as ScreenIntentModule;

test("detects explicit screen and page reading requests", () => {
  const prompts = [
    "Read my screen",
    "read my page",
    "take a screenshot and analyze it",
    "Take a screenshot and tell me what it says",
    "take scren shot and analyze it",
    "what does this page say",
    "what's on this screen",
    "what\u2019s on my screen",
    "tell me what you see",
    "what can you see on my monitor",
    "what app do u seel",
    "which window do you see",
    "read everything on my devive",
    "inspect my computer",
    "what is on my monitor",
  ];

  for (const prompt of prompts) {
    assert.equal(isScreenReadIntent(prompt), true, prompt);
  }
});

test("normalizes common screenshot typos", () => {
  assert.equal(
    normalizeScreenIntentText("take scren shot"),
    "take screen shot"
  );
  assert.equal(
    normalizeScreenIntentText("take a screnshot"),
    "take a screenshot"
  );
  assert.equal(
    normalizeScreenIntentText("what app do u seel"),
    "what app do you see"
  );
  assert.equal(
    normalizeScreenIntentText("read everything on my devive"),
    "read everything on my device"
  );
  assert.equal(
    normalizeScreenIntentText("what\u2019s on my screen"),
    "what's on my screen"
  );
  assert.equal(
    normalizeScreenIntentText("\u201cread my screen\u201d"),
    '"read my screen"'
  );
});

test("does not hijack normal research prompts", () => {
  const prompts = [
    "research my competitors",
    "look up screenshot software",
    "what is screen capture software",
    "summarize this article about screenshots",
    "open the dashboard page",
    "what do you see as the next marketing step",
    "which app do you see as better for editing",
  ];

  for (const prompt of prompts) {
    assert.equal(isScreenReadIntent(prompt), false, prompt);
  }
});

test("keeps desktop and website screen intent behavior aligned", () => {
  const prompts = [
    "Read my screen",
    "what\u2019s on my screen",
    "what can you see on my monitor",
    "read everything on my devive",
    "what do you see as the next marketing step",
    "which app do you see as better for editing",
  ];

  for (const prompt of prompts) {
    assert.equal(
      desktopScreenIntent.normalizeScreenIntentText(prompt),
      normalizeScreenIntentText(prompt),
      prompt
    );
    assert.equal(
      desktopScreenIntent.isScreenReadIntent(prompt),
      isScreenReadIntent(prompt),
      prompt
    );
  }
});
