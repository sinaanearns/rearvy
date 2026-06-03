import assert from "node:assert/strict";
import test from "node:test";

import {
  buildSimpleGreetingResponse,
  detectSimpleGreetingIntent,
} from "./simple-greeting.ts";

test("detects short English greeting variants", () => {
  assert.deepEqual(detectSimpleGreetingIntent("heyy"), { salutation: "hey" });
  assert.deepEqual(detectSimpleGreetingIntent("Hello!"), { salutation: "hello" });
  assert.deepEqual(detectSimpleGreetingIntent("hi there"), { salutation: "hi" });
  assert.deepEqual(detectSimpleGreetingIntent("good morning"), {
    salutation: "good-morning",
  });
});

test("does not hijack greeting-prefixed task requests", () => {
  assert.equal(detectSimpleGreetingIntent("hey open google"), null);
  assert.equal(detectSimpleGreetingIntent("hi can you send a gmail"), null);
  assert.equal(detectSimpleGreetingIntent("hello fix this bug"), null);
});

test("builds English-only greeting copy", () => {
  const intent = detectSimpleGreetingIntent("heyy");

  assert.equal(
    intent ? buildSimpleGreetingResponse(intent) : "",
    "Hey. What would you like to work on?"
  );
});
