import assert from "node:assert/strict";
import test from "node:test";
import { CLIENT_FINDER_PROMPT } from "./chat-prompts.ts";

test("client finder prompt asks for the missing lead qualification fields", () => {
  assert.match(CLIENT_FINDER_PROMPT, /what my business does/i);
  assert.match(CLIENT_FINDER_PROMPT, /who I serve/i);
  assert.match(CLIENT_FINDER_PROMPT, /where I sell/i);
  assert.match(CLIENT_FINDER_PROMPT, /budget or deal size/i);
});

test("client finder prompt requires source-backed ranked research", () => {
  assert.match(CLIENT_FINDER_PROMPT, /search the web for multiple companies/i);
  assert.match(CLIENT_FINDER_PROMPT, /explain why each one fits/i);
  assert.match(CLIENT_FINDER_PROMPT, /cite the sources you used/i);
  assert.match(CLIENT_FINDER_PROMPT, /rank the best leads first/i);
});