import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAssistantAlertHref,
  clampAssistantMessage,
} from "@/lib/assistant-alerts";

test("buildAssistantAlertHref falls back when there is no chat id", () => {
  assert.equal(buildAssistantAlertHref({}), "/chat/new?fresh=true");
});

test("buildAssistantAlertHref encodes chat ids", () => {
  assert.equal(
    buildAssistantAlertHref({ chat_id: "chat/one?x=1" }),
    "/chat/chat%2Fone%3Fx%3D1"
  );
});

test("buildAssistantAlertHref encodes project and chat path segments", () => {
  assert.equal(
    buildAssistantAlertHref({
      project_id: "project/alpha",
      chat_id: "chat beta",
    }),
    "/projects/project%2Falpha/chat/chat%20beta"
  );
});

test("clampAssistantMessage trims long text to the requested maximum", () => {
  const result = clampAssistantMessage("  abcdefghij  ", 6);

  assert.equal(result.length, 6);
});
