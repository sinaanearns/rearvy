import assert from "node:assert/strict";
import test, { describe, it } from "node:test";
import {
  detectChatGptImageIntent,
  buildChatGptImageTaskInstruction,
} from "./chatgpt-image-intent.ts";

describe("detectChatGptImageIntent", () => {
  describe("positive matches", () => {
    it("detects 'generate a PNG of ...'", () => {
      const result = detectChatGptImageIntent("generate a PNG of a sunset over the ocean");
      assert.notEqual(result, null);
      assert.equal(result?.format, "png");
      assert.match(result?.prompt ?? "", /sunset/);
    });

    it("detects 'create an image of ...'", () => {
      const result = detectChatGptImageIntent("create an image of a cyberpunk city at night");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /cyberpunk city/);
    });

    it("detects 'make me a picture of ...'", () => {
      const result = detectChatGptImageIntent("make me a picture of a black cat on a rooftop");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /black cat/);
    });

    it("detects 'draw a ...'", () => {
      const result = detectChatGptImageIntent("draw a dragon flying over mountains");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /dragon/);
    });

    it("detects 'generate an illustration of ...'", () => {
      const result = detectChatGptImageIntent("generate an illustration of a medieval castle");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /medieval castle/);
    });

    it("detects 'create a photo of ...'", () => {
      const result = detectChatGptImageIntent("create a photo of a golden retriever on a beach");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /golden retriever/);
    });

    it("detects jpg format", () => {
      const result = detectChatGptImageIntent("generate a jpg of a tropical island");
      assert.notEqual(result, null);
      assert.equal(result?.format, "jpg");
    });

    it("detects jpeg normalized to jpg", () => {
      const result = detectChatGptImageIntent("create a jpeg of a mountain landscape");
      assert.notEqual(result, null);
      assert.equal(result?.format, "jpg");
    });

    it("detects webp format", () => {
      const result = detectChatGptImageIntent("make a webp of a futuristic robot");
      assert.notEqual(result, null);
      assert.equal(result?.format, "webp");
    });

    it("returns null format when no format specified", () => {
      const result = detectChatGptImageIntent("generate an image of a lion");
      assert.notEqual(result, null);
      assert.equal(result?.format, null);
    });

    it("handles 'generate a PNG of' shorthand", () => {
      const result = detectChatGptImageIntent("generate a PNG of this");
      assert.notEqual(result, null);
      assert.equal(result?.prompt, "this");
    });

    it("strips 'using chatgpt' suffix", () => {
      const result = detectChatGptImageIntent("create an image of a sunset using chatgpt");
      assert.notEqual(result, null);
      assert.doesNotMatch(result?.prompt ?? "", /chatgpt/i);
    });

    it("handles polite prefix 'please generate ...'", () => {
      const result = detectChatGptImageIntent("please generate a picture of a neon city");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /neon city/);
    });

    it("handles 'can you create ...'", () => {
      const result = detectChatGptImageIntent("can you create an image of a space station");
      assert.notEqual(result, null);
      assert.match(result?.prompt ?? "", /space station/);
    });

    it("handles 'generate a wallpaper of ...'", () => {
      const result = detectChatGptImageIntent("generate a wallpaper of an aurora borealis");
      assert.notEqual(result, null);
    });

    it("detects misspelled 'genrate a chicken image'", () => {
      const result = detectChatGptImageIntent("genrate a chicken image");
      assert.notEqual(result, null);
      assert.equal(result?.prompt, "chicken");
    });

    it("detects noun-first 'make a chicken image on chatgpt'", () => {
      const result = detectChatGptImageIntent("make a chicken image on chatgpt");
      assert.notEqual(result, null);
      assert.equal(result?.prompt, "chicken");
    });
  });

  describe("negative matches (false positives blocked)", () => {
    it("does NOT match 'generate a report'", () => {
      assert.equal(detectChatGptImageIntent("generate a report on quarterly sales"), null);
    });

    it("does NOT match 'create a document'", () => {
      assert.equal(detectChatGptImageIntent("create a document about marketing strategy"), null);
    });

    it("does NOT match 'make a plan'", () => {
      assert.equal(detectChatGptImageIntent("make a plan for the next quarter"), null);
    });

    it("does NOT match 'create a website'", () => {
      assert.equal(detectChatGptImageIntent("create a website for my business"), null);
    });

    it("does NOT match 'generate a chart'", () => {
      assert.equal(detectChatGptImageIntent("generate a chart from this data"), null);
    });

    it("does NOT match 'make a list'", () => {
      assert.equal(detectChatGptImageIntent("make a list of my top clients"), null);
    });

    it("does NOT match plain greetings", () => {
      assert.equal(detectChatGptImageIntent("hello how are you"), null);
    });

    it("does NOT match 'search the web'", () => {
      assert.equal(detectChatGptImageIntent("search the web for AI news"), null);
    });

    it("does NOT match null input", () => {
      assert.equal(detectChatGptImageIntent(null), null);
    });

    it("does NOT match empty string", () => {
      assert.equal(detectChatGptImageIntent(""), null);
    });
  });

  describe("prompt extraction quality", () => {
    it("extracts clean prompt without the trigger phrase", () => {
      const result = detectChatGptImageIntent("generate a PNG of a red sports car");
      assert.equal(result?.prompt, "a red sports car");
    });

    it("does not return a trivially short prompt", () => {
      const result = detectChatGptImageIntent("generate an image of it");
      assert.equal(result, null);
    });
  });
});

describe("buildChatGptImageTaskInstruction", () => {
  it("includes the image prompt in the instruction", () => {
    const instruction = buildChatGptImageTaskInstruction({
      prompt: "a sunset over the ocean",
      format: "png",
    });
    assert.match(instruction, /a sunset over the ocean/);
    assert.match(instruction, /https:\/\/chatgpt\.com/);
  });

  it("includes format hint when format is specified", () => {
    const instruction = buildChatGptImageTaskInstruction({
      prompt: "a futuristic city",
      format: "png",
    });
    assert.match(instruction, /PNG/);
  });

  it("includes save instruction with rearvy-image filename", () => {
    const instruction = buildChatGptImageTaskInstruction({
      prompt: "a mountain landscape",
      format: null,
    });
    assert.match(instruction, /rearvy-image-/);
    assert.match(instruction, /Downloads folder/);
  });

  it("includes login navigation instruction", () => {
    const instruction = buildChatGptImageTaskInstruction({
      prompt: "a dog playing fetch",
      format: null,
    });
    assert.match(instruction, /login or landing page/i);
  });

  it("includes Plus subscription error handling", () => {
    const instruction = buildChatGptImageTaskInstruction({
      prompt: "a cartoon elephant",
      format: null,
    });
    assert.match(instruction, /Plus/);
  });
});
