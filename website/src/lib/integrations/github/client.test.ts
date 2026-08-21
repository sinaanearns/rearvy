import assert from "node:assert/strict";
import test from "node:test";

import { readGitHubTokenExchangeResponse } from "./client";

test("readGitHubTokenExchangeResponse reads successful token responses", async () => {
  const response = new Response(
    JSON.stringify({ access_token: "gho_token", scope: "repo" }),
    { headers: { "content-type": "application/json" } }
  );

  assert.deepEqual(await readGitHubTokenExchangeResponse(response), {
    accessToken: "gho_token",
    error: undefined,
    errorDescription: undefined,
  });
});

test("readGitHubTokenExchangeResponse reads provider errors", async () => {
  const response = new Response(
    JSON.stringify({
      error: "bad_verification_code",
      error_description: "The code passed is incorrect.",
    })
  );

  assert.deepEqual(await readGitHubTokenExchangeResponse(response), {
    accessToken: undefined,
    error: "bad_verification_code",
    errorDescription: "The code passed is incorrect.",
  });
});

test("readGitHubTokenExchangeResponse falls back for malformed and non-object JSON", async () => {
  assert.deepEqual(await readGitHubTokenExchangeResponse(new Response("not-json")), {
    accessToken: undefined,
    error: undefined,
    errorDescription: undefined,
  });
  assert.deepEqual(await readGitHubTokenExchangeResponse(new Response("[]")), {
    accessToken: undefined,
    error: undefined,
    errorDescription: undefined,
  });
  assert.deepEqual(await readGitHubTokenExchangeResponse(new Response('"token"')), {
    accessToken: undefined,
    error: undefined,
    errorDescription: undefined,
  });
});
