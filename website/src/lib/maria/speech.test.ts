import assert from "node:assert/strict";
import { test } from "node:test";

import { selectMariaVoice, speakMariaText, warmMariaVoices } from "./speech";

test("Maria speech helpers are safe without browser speech APIs", () => {
  assert.doesNotThrow(() => warmMariaVoices());
  assert.equal(selectMariaVoice(), null);
  assert.equal(speakMariaText("Hello from Maria"), null);
});
