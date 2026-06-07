import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseMariaVoiceAiText } from "./voice-ai-response";

describe("parseMariaVoiceAiText", () => {
  it("returns text from JSON model output", () => {
    assert.equal(
      parseMariaVoiceAiText('{"text":" Cleaned transcript. " }'),
      "Cleaned transcript."
    );
  });

  it("supports fenced and embedded JSON output", () => {
    assert.equal(
      parseMariaVoiceAiText('```json\n{"text":"Fenced text"}\n```'),
      "Fenced text"
    );
    assert.equal(
      parseMariaVoiceAiText('Result: {"text":"Embedded {safe} text"} done.'),
      "Embedded {safe} text"
    );
  });

  it("falls back to plain cleaned text when no JSON object is available", () => {
    assert.equal(parseMariaVoiceAiText("  Plain dictation cleanup.  "), "Plain dictation cleanup.");
  });

  it("returns an empty string for JSON objects without string text", () => {
    assert.equal(parseMariaVoiceAiText('{"message":"wrong key"}'), "");
    assert.equal(parseMariaVoiceAiText('{"text":123}'), "");
  });
});
