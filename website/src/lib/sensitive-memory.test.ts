import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hasCredentialLikeText,
  redactSensitiveMemoryText,
} from "./sensitive-memory";

test("hasCredentialLikeText detects common credential keywords", () => {
  for (const value of [
    "here is my password",
    "PASSCODE reset link",
    "please store the api key",
    "share the API  KEY with support",
    "the client secret rotated",
    "rotate the access token now",
    "refresh token expired",
    "send a Bearer value",
    "upload the private key",
    "one-time OTP arrived",
    "enable 2fa",
    "MFA challenge",
    "use the recovery code",
  ]) {
    assert.equal(hasCredentialLikeText(value), true, value);
  }
});

test("hasCredentialLikeText ignores unrelated text", () => {
  assert.equal(hasCredentialLikeText("let's meet for lunch tomorrow"), false);
  assert.equal(hasCredentialLikeText("keyboard shortcuts help"), false);
  assert.equal(hasCredentialLikeText("the secret sauce recipe"), true);
});

test("redactSensitiveMemoryText masks credentials embedded in URLs", () => {
  const redacted = redactSensitiveMemoryText(
    "connect to https://admin:s3cr3t@db.example.com/path"
  );
  assert.equal(
    redacted,
    "connect to https://[REDACTED_CREDENTIALS]@db.example.com/path"
  );
});

test("redactSensitiveMemoryText masks key/value credential pairs", () => {
  assert.equal(
    redactSensitiveMemoryText("password: hunter2"),
    "password: [REDACTED_SECRET]"
  );
  assert.equal(
    redactSensitiveMemoryText('api key = "abcd-1234"'),
    "api key: [REDACTED_SECRET]"
  );
  assert.equal(
    redactSensitiveMemoryText("access token='xyz'"),
    "access token: [REDACTED_SECRET]"
  );
});

test("redactSensitiveMemoryText masks known provider token formats", () => {
  const cases = [
    "sk-abcdefghijklmnop",
    "ghp_abcdefghijklmnop",
    "github_pat_abcdefghijklmnop",
    "xoxb-abcdefghijklmnop",
    "ya29.abcdefghijklmnop",
    "AIzaabcdefghijklmnop",
    "nvapi-abcdefghijklmnop",
  ];
  for (const token of cases) {
    assert.equal(
      redactSensitiveMemoryText(`token is ${token} ok`),
      "token is [REDACTED_SECRET] ok",
      token
    );
  }
});

test("redactSensitiveMemoryText masks JWT-like triplets", () => {
  const jwt =
    "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbb.cccccccccccccccc";
  assert.equal(
    redactSensitiveMemoryText(`bearer ${jwt}`),
    "bearer [REDACTED_SECRET]"
  );
});

test("redactSensitiveMemoryText leaves ordinary text untouched", () => {
  const value = "meeting notes: discuss the roadmap and the budget";
  assert.equal(redactSensitiveMemoryText(value), value);
});
