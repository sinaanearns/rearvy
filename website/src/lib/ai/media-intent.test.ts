import assert from "node:assert/strict";
import test from "node:test";

import { detectMediaGenerationIntent } from "./media-intent.ts";
import { normalizeGeneratedMediaPrompt } from "./media-prompt.ts";

test("detects direct image requests and extracts the user prompt", () => {
  const intent = detectMediaGenerationIntent("make an image of chickebn");

  assert.equal(intent?.mode, "image");
  assert.equal(intent?.prompt, "chickebn");
  assert.equal(intent?.aspectRatio, "4:5");
});

test("detects slash image commands", () => {
  const intent = detectMediaGenerationIntent("/imagine a red shoe on a table");

  assert.equal(intent?.mode, "image");
  assert.match(intent?.prompt ?? "", /red shoe on a table/i);
  assert.equal(intent?.aspectRatio, "4:5");
});

test("detects platform-specific image ratios", () => {
  assert.equal(
    detectMediaGenerationIntent("make a youtube thumbnail of spicy chicken")
      ?.aspectRatio,
    "16:9"
  );
  assert.equal(
    detectMediaGenerationIntent("make an instagram story image of a shoe")
      ?.aspectRatio,
    "9:16"
  );
  assert.equal(
    detectMediaGenerationIntent("make a cinematic image of a car")?.aspectRatio,
    "21:9"
  );
});

test("detects direct video requests", () => {
  const intent = detectMediaGenerationIntent(
    "generate a short video of a chicken walking through grass"
  );

  assert.equal(intent?.mode, "video");
  assert.equal(intent?.prompt, "a chicken walking through grass");
  assert.equal(intent?.aspectRatio, "16:9");
});

test("detects design with AI product prompts", () => {
  const intent = detectMediaGenerationIntent(
    "Design a tea cup with Labubu patterns."
  );

  assert.equal(intent?.mode, "image");
  assert.equal(intent?.prompt, "a tea cup with Labubu patterns");
  assert.equal(intent?.aspectRatio, "1:1");
  assert.equal(intent?.presentation, "design");
});

test("detects design with AI logo prompts", () => {
  const intent = detectMediaGenerationIntent(
    "Design a logo for my perfume brand 'Veloria'."
  );

  assert.equal(intent?.mode, "image");
  assert.equal(intent?.prompt, "a logo for my perfume brand 'Veloria'");
  assert.equal(intent?.aspectRatio, "1:1");
  assert.equal(intent?.presentation, "design");
});

test("detects design with AI tech pack prompts", () => {
  const intent = detectMediaGenerationIntent(
    "Generate a tech pack for a backpack with 3-view drawing and BOM."
  );

  assert.equal(intent?.mode, "image");
  assert.equal(
    intent?.prompt,
    "a tech pack for a backpack with 3-view drawing and BOM"
  );
  assert.equal(intent?.aspectRatio, "16:9");
  assert.equal(intent?.presentation, "design");
});

test("detects uploaded-image edit requests", () => {
  const intent = detectMediaGenerationIntent("edit this image to change the logo text to Rearvy", {
    hasImageInput: true,
  });

  assert.equal(intent?.mode, "image-edit");
  assert.equal(intent?.prompt, "change the logo text to Rearvy");
});

test("routes generated-image prompts with uploads through image edit", () => {
  const intent = detectMediaGenerationIntent("make a cinematic image of this product", {
    hasImageInput: true,
  });

  assert.equal(intent?.mode, "image-edit");
  assert.equal(intent?.prompt, "this product");
  assert.equal(intent?.aspectRatio, "21:9");
});

test("does not hijack debugging requests about image generation", () => {
  assert.equal(
    detectMediaGenerationIntent("can you fix this image generation bug?"),
    null
  );
});

test("repairs and enhances spec-style prompts before sending them to an image model", () => {
  const prompt = normalizeGeneratedMediaPrompt(
    "A detailed description of chickebn. Show chickebn's design, color scheme, and layout. Use a modern, minimalist style with attention to detail.",
    "image"
  );

  assert.match(prompt, /^A clear image of a chicken\./);
  assert.match(prompt, /Preserve every explicit user detail/);
  assert.match(prompt, /Avoid rendered text/);
});

test("enhances every image prompt", () => {
  const prompt = normalizeGeneratedMediaPrompt("man eating chicken", "image");

  assert.match(prompt, /^A clear image of man eating chicken\./);
  assert.match(prompt, /intentional composition/);
  assert.match(prompt, /polished finished look/);
});

test("enhances visible-text prompts without adding a no-text guard", () => {
  const prompt = normalizeGeneratedMediaPrompt(
    "a poster that says SALE",
    "image"
  );

  assert.match(prompt, /^A clear image of a poster that says SALE\./);
  assert.match(prompt, /Render any requested visible text exactly as written/);
  assert.equal(prompt.includes("Avoid rendered text"), false);
});

test("does not enhance video prompts", () => {
  const prompt = normalizeGeneratedMediaPrompt(
    "a chicken walking through grass",
    "video"
  );

  assert.equal(prompt, "a chicken walking through grass");
});

test("does not enhance image edit instructions", () => {
  const prompt = normalizeGeneratedMediaPrompt("change the shirt to red", "image-edit");

  assert.equal(prompt, "change the shirt to red");
});
