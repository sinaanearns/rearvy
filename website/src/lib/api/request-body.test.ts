import assert from "node:assert/strict";
import test from "node:test";

import {
  isRequestBodyError,
  readJsonRecord,
  readResponseJsonRecord,
} from "./request-body";

function makeRequest(body: string) {
  return new Request("https://www.rearvy.com/api/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

test("readJsonRecord accepts JSON objects", async () => {
  assert.deepEqual(await readJsonRecord(makeRequest('{"title":"Task"}')), {
    title: "Task",
  });
});

test("readJsonRecord rejects malformed JSON", async () => {
  await assert.rejects(
    () => readJsonRecord(makeRequest("{")),
    /Invalid JSON body\./
  );
});

test("readJsonRecord rejects non-object JSON", async () => {
  await assert.rejects(
    () => readJsonRecord(makeRequest("[]")),
    /Request body must be a JSON object\./
  );
});

test("readResponseJsonRecord accepts JSON objects", async () => {
  assert.deepEqual(
    await readResponseJsonRecord(new Response('{"status":"ok"}')),
    { status: "ok" }
  );
});

test("readResponseJsonRecord falls back for malformed and non-object JSON", async () => {
  assert.deepEqual(await readResponseJsonRecord(new Response("not-json")), {});
  assert.deepEqual(await readResponseJsonRecord(new Response("[]")), {});
  assert.deepEqual(await readResponseJsonRecord(new Response('"ok"')), {});
});

test("isRequestBodyError identifies shared body parser errors", () => {
  assert.equal(isRequestBodyError(new Error("Invalid JSON body.")), true);
  assert.equal(
    isRequestBodyError(new Error("Request body must be a JSON object.")),
    true
  );
  assert.equal(isRequestBodyError(new Error("Database unavailable.")), false);
});
