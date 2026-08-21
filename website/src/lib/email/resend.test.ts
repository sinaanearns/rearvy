import assert from "node:assert/strict";
import test from "node:test";

import { readResendError } from "./resend";

test("readResendError formats Resend error objects", async () => {
  const response = new Response(
    JSON.stringify({ name: "validation_error", message: "Invalid recipient." }),
    { headers: { "content-type": "application/json" } }
  );

  assert.equal(
    await readResendError(response),
    "validation_error: Invalid recipient."
  );
});

test("readResendError falls back for malformed and non-object responses", async () => {
  assert.equal(await readResendError(new Response("not-json")), "");
  assert.equal(await readResendError(new Response("[]")), "");
  assert.equal(await readResendError(new Response('"failed"')), "");
});
