import assert from "node:assert/strict";
import test from "node:test";

import { readGmailApiPayload } from "./server";

test("readGmailApiPayload returns JSON objects", async () => {
  const response = new Response(JSON.stringify({ id: "draft-1" }), {
    headers: { "content-type": "application/json" },
  });

  assert.deepEqual(await readGmailApiPayload(response), { id: "draft-1" });
});

test("readGmailApiPayload falls back for malformed and non-object JSON", async () => {
  assert.deepEqual(await readGmailApiPayload(new Response("not-json")), {});
  assert.deepEqual(await readGmailApiPayload(new Response("[]")), {});
  assert.deepEqual(await readGmailApiPayload(new Response('"ok"')), {});
});
