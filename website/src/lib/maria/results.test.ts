import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeMariaResult,
  normalizeMariaResults,
} from "./results";

test("normalizeMariaResult keeps safe web URLs", () => {
  assert.deepEqual(
    normalizeMariaResult({
      title: "Example",
      url: " https://example.com/path?x=1 ",
      description: "  Short description  ",
      summary: " Summary ",
    }),
    {
      title: "Example",
      url: "https://example.com/path?x=1",
      description: "Short description",
      summary: "Summary",
    }
  );
});

test("normalizeMariaResult strips unsafe URLs but preserves result text", () => {
  assert.deepEqual(
    normalizeMariaResult({
      title: "Unsafe result",
      url: "javascript:alert(1)",
      summary: "Readable result text",
    }),
    {
      title: "Unsafe result",
      url: "",
      description: "",
      summary: "Readable result text",
    }
  );
});

test("normalizeMariaResults drops empty or malformed results and clamps count", () => {
  assert.deepEqual(
    normalizeMariaResults(
      [
        null,
        {},
        { title: "One", url: "https://one.example" },
        { title: "Two", url: "https://two.example" },
        { title: "Three", url: "https://three.example" },
      ],
      2
    ).map((result) => result.title),
    ["One", "Two"]
  );
});
