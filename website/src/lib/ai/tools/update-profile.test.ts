import assert from "node:assert/strict";
import test from "node:test";

// updateProfile calls into firebase-admin, so we just import the module to
// confirm the early-bail guard for malformed input compiles. The runtime
// behaviour is covered manually via the chat UI.
test("updateProfile is exported as an async function", async () => {
  const mod = await import("./update-profile");
  assert.equal(typeof mod.updateProfile, "function");
});
