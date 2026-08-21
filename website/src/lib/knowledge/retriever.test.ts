import assert from "node:assert/strict";
import test from "node:test";
import { cosineSimilarity } from "./retriever";

test("cosineSimilarity computes correct vector alignment", () => {
  const v1 = [1, 0, 0];
  const v2 = [1, 0, 0];
  const v3 = [0, 1, 0];

  assert.equal(cosineSimilarity(v1, v2), 1);
  assert.equal(cosineSimilarity(v1, v3), 0);
});

test("cosineSimilarity returns 0 for different dimensions", () => {
  assert.equal(cosineSimilarity([1, 2], [1, 2, 3]), 0);
});
