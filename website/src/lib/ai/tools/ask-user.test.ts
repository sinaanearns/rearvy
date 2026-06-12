import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeAskUserInput,
  normalizeAskUserOutput,
} from "./ask-user.ts";

test("normalizeAskUserInput applies defaults and keeps choices", () => {
  const input = normalizeAskUserInput({
    prompt: " Which website\nshould I use? ",
    title: " Website\tneeded ",
    choices: [
      {
        id: " shopify ",
        label: " Shopify\nStore ",
        description: " Use their main store. ",
      },
    ],
  });

  assert.equal(input.kind, "clarification");
  assert.equal(input.prompt, "Which website should I use?");
  assert.equal(input.title, "Website needed");
  assert.equal(input.allowSkip, true);
  assert.equal(input.sensitive, false);
  assert.equal(input.choices?.[0]?.id, "shopify");
  assert.equal(input.choices?.[0]?.label, "Shopify Store");
  assert.equal(input.choices?.[0]?.description, "Use their main store.");
});

test("normalizeAskUserInput trims and bounds optional text", () => {
  const input = normalizeAskUserInput({
    prompt: "p".repeat(2100),
    placeholder: " \n ",
    context: " Need\tmore context. ",
    requestedAction: "a".repeat(1100),
  });

  assert.equal(input.prompt.length, 2000);
  assert.equal(input.placeholder, undefined);
  assert.equal(input.context, "Need more context.");
  assert.equal(input.requestedAction?.length, 1000);
});

test("normalizeAskUserOutput accepts answered replies with attachment metadata", () => {
  const output = normalizeAskUserOutput({
    status: "answered",
    answer: " Use\nexample.com ",
    choice: " shopify\t ",
    attachments: [
      {
        name: " code\n.png ",
        contentType: " image/png ",
        size: 1024,
        kind: "image",
      },
    ],
    respondedAt: "2026-06-11T10:00:00.000Z",
  });

  assert.equal(output.status, "answered");
  assert.equal(output.answer, "Use example.com");
  assert.equal(output.choice, "shopify");
  assert.equal(output.respondedAt, "2026-06-11T10:00:00.000Z");
  assert.equal(output.attachments?.[0]?.name, "code .png");
  assert.equal(output.attachments?.[0]?.contentType, "image/png");
  assert.equal(output.attachments?.[0]?.kind, "image");
});

test("normalizeAskUserOutput drops blank optional text and invalid timestamps", () => {
  const output = normalizeAskUserOutput({
    status: "skipped",
    answer: " \n ",
    choice: " \t ",
    respondedAt: "not a date",
  });

  assert.deepEqual(output, {
    status: "skipped",
  });
});

test("normalizeAskUserOutput rejects non-finite attachment sizes", () => {
  assert.throws(() =>
    normalizeAskUserOutput({
      status: "answered",
      attachments: [
        {
          name: "code.png",
          contentType: "image/png",
          size: Number.POSITIVE_INFINITY,
        },
      ],
    })
  );
});
