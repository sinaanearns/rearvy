import assert from "node:assert/strict";
import test from "node:test";
import type { NextRequest } from "next/server";

import { POST } from "./route";

function makeRequest(body: string, forwardedFor: string): NextRequest {
  return new Request("https://www.rearvy.com/api/chat/demo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": forwardedFor,
    },
    body,
  }) as NextRequest;
}

test("demo chat route rejects malformed JSON as a bad request", async () => {
  const response = await POST(makeRequest("{", "198.51.100.10"));

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Invalid JSON body" });
});

test("demo chat route rate limits repeated requests from one client", async () => {
  const clientIp = "198.51.100.20";

  for (let index = 0; index < 20; index++) {
    const response = await POST(makeRequest("{", clientIp));
    assert.equal(response.status, 400);
  }

  const response = await POST(makeRequest("{", clientIp));

  assert.equal(response.status, 429);
  assert.deepEqual(await response.json(), {
    error: "Too many demo chat requests. Try again shortly.",
  });
});
