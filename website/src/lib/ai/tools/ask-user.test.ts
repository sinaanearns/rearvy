import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAskUserInput,
  normalizeAskUserOutput,
} from "./ask-user.ts";

test("normalizeAskUserInput applies defaults and keeps choices", () => {
  const input = normalizeAskUserInput({
    prompt: "Which website should I use?",
    choices: [{ id: "shopify", label: "Shopify" }],
  });

  assert.equal(input.kind, "clarification");
  assert.equal(input.prompt, "Which website should I use?");
  assert.equal(input.allowSkip, true);
  assert.equal(input.sensitive, false);
  assert.equal(input.choices?.[0]?.id, "shopify");
});

test("normalizeAskUserOutput accepts answered replies with attachment metadata", () => {
  const output = normalizeAskUserOutput({
    status: "answered",
    answer: "Use example.com",
    attachments: [
      {
        name: "code.png",
        contentType: "image/png",
        size: 1024,
        kind: "image",
      },
    ],
  });

  assert.equal(output.status, "answered");
  assert.equal(output.answer, "Use example.com");
  assert.equal(output.attachments?.[0]?.kind, "image");
});
