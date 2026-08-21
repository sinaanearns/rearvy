import assert from "node:assert/strict";
import test from "node:test";
import { splitTextIntoChunks } from "./chunker";

test("splitTextIntoChunks splits long text", () => {
  const text = "a ".repeat(1000); // 2000 characters
  const chunks = splitTextIntoChunks(text, 500, 100);
  assert.ok(chunks.length > 1);
  assert.ok(chunks[0].length <= 500);
});

test("splitTextIntoChunks returns single chunk if shorter than size", () => {
  const text = "Hello world";
  const chunks = splitTextIntoChunks(text, 100, 20);
  assert.deepEqual(chunks, ["Hello world"]);
});
