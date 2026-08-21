import test from "node:test";
import assert from "node:assert/strict";

import {
  isPrivateOrLocalMcpHostname,
  readMcpToolResultError,
  toMcpToolArguments,
} from "./hub";

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

test("readMcpToolResultError rejects MCP isError responses", () => {
  assert.equal(
    readMcpToolResultError({
      isError: true,
      content: [{ type: "text", text: "Connector refused the operation" }],
    }),
    "Connector refused the operation"
  );
  assert.equal(readMcpToolResultError({ content: [] }), null);
});

test("private and link-local MCP targets are identified", () => {
  assert.equal(isPrivateOrLocalMcpHostname("localhost"), true);
  assert.equal(isPrivateOrLocalMcpHostname("127.0.0.1"), true);
  assert.equal(isPrivateOrLocalMcpHostname("169.254.169.254"), true);
  assert.equal(isPrivateOrLocalMcpHostname("192.168.1.10"), true);
  assert.equal(isPrivateOrLocalMcpHostname("mcp.example.com"), false);
});
