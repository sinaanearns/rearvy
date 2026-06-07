import test from "node:test";
import assert from "node:assert/strict";

import { toMcpToolArguments } from "./hub";

test("toMcpToolArguments keeps only object arguments with named keys", () => {
  assert.deepEqual(toMcpToolArguments(null), {});
  assert.deepEqual(toMcpToolArguments(["bad"]), {});
  assert.deepEqual(
    toMcpToolArguments({
      query: "supplier research",
      "": "ignored",
      "   ": "ignored",
      limit: 5,
    }),
    {
      query: "supplier research",
      limit: 5,
    }
  );
});
