import assert from "node:assert/strict";
import { test } from "node:test";

import {
  gmailComposePayloadSchema,
  gmailComposeToolInputSchema,
  gmailSendActionRequestSchema,
} from "./compose-shared";

test("gmailComposePayloadSchema trims and defaults optional recipients", () => {
  const parsed = gmailComposePayloadSchema.parse({
    to: ["  user@example.com  "],
    subject: "  Hello  ",
    body: "  Body text  ",
  });

  assert.deepEqual(parsed.to, ["user@example.com"]);
  assert.deepEqual(parsed.cc, []);
  assert.deepEqual(parsed.bcc, []);
  assert.equal(parsed.subject, "Hello");
  assert.equal(parsed.body, "Body text");
});

test("gmailComposePayloadSchema rejects invalid or missing recipients", () => {
  assert.equal(
    gmailComposePayloadSchema.safeParse({
      to: [],
      subject: "Hi",
      body: "There",
    }).success,
    false
  );

  assert.equal(
    gmailComposePayloadSchema.safeParse({
      to: ["not-an-email"],
      subject: "Hi",
      body: "There",
    }).success,
    false
  );
});

test("gmailComposePayloadSchema enforces subject and body limits", () => {
  assert.equal(
    gmailComposePayloadSchema.safeParse({
      to: ["user@example.com"],
      subject: "",
      body: "There",
    }).success,
    false
  );

  assert.equal(
    gmailComposePayloadSchema.safeParse({
      to: ["user@example.com"],
      subject: "Hi",
      body: "x".repeat(10001),
    }).success,
    false
  );
});

test("gmailComposePayloadSchema caps recipient list length", () => {
  const eleven = Array.from({ length: 11 }, (_, i) => `user${i}@example.com`);
  assert.equal(
    gmailComposePayloadSchema.safeParse({
      to: eleven,
      subject: "Hi",
      body: "There",
    }).success,
    false
  );
});

test("gmailComposeToolInputSchema defaults sendNowPreferred to false", () => {
  const parsed = gmailComposeToolInputSchema.parse({
    to: ["user@example.com"],
    subject: "Hi",
    body: "There",
  });
  assert.equal(parsed.sendNowPreferred, false);
});

test("gmailSendActionRequestSchema validates action enum and draft", () => {
  const parsed = gmailSendActionRequestSchema.parse({
    action: "send",
    fromEmail: "sender@example.com",
    draft: {
      to: ["user@example.com"],
      subject: "Hi",
      body: "There",
    },
  });
  assert.equal(parsed.action, "send");
  assert.equal(parsed.fromEmail, "sender@example.com");

  assert.equal(
    gmailSendActionRequestSchema.safeParse({
      action: "archive",
      draft: {
        to: ["user@example.com"],
        subject: "Hi",
        body: "There",
      },
    }).success,
    false
  );
});
