import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMemoryToolTrace,
  compactMemoryToolResult,
} from "./memory-trace";

test("compactMemoryToolResult clones JSON values and strips undefined fields", () => {
  assert.deepEqual(
    compactMemoryToolResult({
      ok: true,
      count: 2,
      skipped: undefined,
      nested: { label: "done", omitted: undefined },
    }),
    {
      ok: true,
      count: 2,
      nested: { label: "done" },
    }
  );
});

test("compactMemoryToolResult falls back for non-serializable values", () => {
  const result = compactMemoryToolResult(() => "not serialized");

  assert.equal(typeof result, "string");
  assert.match(String(result), /not serialized/);
});

test("compactMemoryToolResult truncates long serialized payloads", () => {
  const result = compactMemoryToolResult({ text: "x".repeat(2500) });

  assert.equal(typeof result, "string");
  assert.equal(String(result).length, 2000);
  assert.ok(String(result).endsWith("..."));
});

test("buildMemoryToolTrace pairs tool calls with compacted results", () => {
  assert.deepEqual(
    buildMemoryToolTrace([
      {
        role: "assistant",
        content: [
          {
            type: "tool-call",
            toolCallId: "call-1",
            toolName: "searchMemory",
            args: { query: "shopify" },
          },
          {
            type: "tool-result",
            toolCallId: "call-1",
            result: { matches: ["one"], omitted: undefined },
          },
        ],
      },
    ]),
    {
      tools: [
        {
          name: "searchMemory",
          args: { query: "shopify" },
          result: { matches: ["one"] },
        },
      ],
    }
  );
});
