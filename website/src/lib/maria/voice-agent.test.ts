import assert from "node:assert/strict";
import test from "node:test";

import { parseToolArgs, parseVoiceAgentMessage } from "./voice-agent";

test("parseToolArgs accepts object arguments from strings and records", () => {
  assert.deepEqual(parseToolArgs('{"command":"open app","mode":"research"}'), {
    command: "open app",
    mode: "research",
  });

  assert.deepEqual(parseToolArgs({ command: "click button" }), {
    command: "click button",
  });
});

test("parseToolArgs rejects malformed and non-object values", () => {
  assert.deepEqual(parseToolArgs("not-json"), {});
  assert.deepEqual(parseToolArgs("[]"), {});
  assert.deepEqual(parseToolArgs('"command"'), {});
  assert.deepEqual(parseToolArgs(null), {});
});

test("parseVoiceAgentMessage accepts JSON object messages only", () => {
  assert.deepEqual(parseVoiceAgentMessage('{"type":"session.ready","session_id":"abc"}'), {
    type: "session.ready",
    session_id: "abc",
  });

  assert.equal(parseVoiceAgentMessage("not-json"), null);
  assert.equal(parseVoiceAgentMessage("[]"), null);
  assert.equal(parseVoiceAgentMessage('"message"'), null);
});
