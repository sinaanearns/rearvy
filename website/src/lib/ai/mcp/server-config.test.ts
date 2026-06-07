import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeMcpServerDocument,
  normalizeMcpTimestamp,
  normalizeNewMcpServer,
  sanitizeMcpServerUpdates,
} from "./server-config";

test("normalizeMcpServerDocument uses document id and normalizes timestamps", () => {
  const server = normalizeMcpServerDocument("doc-server", {
    id: "stored-server",
    user_id: "user_1",
    name: " Local tools ",
    type: "stdio",
    command: " node ",
    args: [" server.js ", "", 42],
    env: { API_KEY: " secret ", bad: 42 },
    url: "https://example.com/mcp",
    created_at: { toDate: () => new Date("2026-01-01T00:00:00.000Z") },
    updated_at: { toDate: () => new Date("invalid") },
  });

  assert.equal(server.id, "doc-server");
  assert.equal(server.name, "Local tools");
  assert.equal(server.type, "stdio");
  assert.equal(server.command, "node");
  assert.deepEqual(server.args, ["server.js"]);
  assert.deepEqual(server.env, { API_KEY: "secret" });
  assert.equal(server.url, undefined);
  assert.equal(server.created_at, "2026-01-01T00:00:00.000Z");
  assert.equal(server.updated_at, null);
});

test("normalizeNewMcpServer validates type and scopes fields by transport", () => {
  assert.equal(normalizeNewMcpServer("user_1", { name: "Bad", type: "other" }), null);

  const server = normalizeNewMcpServer(
    "user_1",
    {
      name: " Search MCP ",
      type: "sse",
      command: "node",
      args: ["server.js"],
      env: { TOKEN: "secret" },
      url: " https://example.com/mcp ",
    },
    new Date("2026-01-01T00:00:00.000Z")
  );

  assert.deepEqual(server, {
    user_id: "user_1",
    name: "Search MCP",
    type: "sse",
    command: null,
    args: [],
    env: {},
    url: "https://example.com/mcp",
    is_active: true,
    created_at: new Date("2026-01-01T00:00:00.000Z"),
    updated_at: new Date("2026-01-01T00:00:00.000Z"),
  });
});

test("sanitizeMcpServerUpdates drops protected and unknown fields", () => {
  const updates = sanitizeMcpServerUpdates(
    {
      id: "stored-server",
      user_id: "user_2",
      created_at: "bad",
      name: " Updated ",
      type: "stdio",
      args: [" run.js ", null],
      env: { TOKEN: " secret ", count: 1 },
      is_active: false,
      unknown: "ignored",
    } as Record<string, unknown>,
    new Date("2026-01-02T00:00:00.000Z")
  );

  assert.deepEqual(updates, {
    name: "Updated",
    type: "stdio",
    args: ["run.js"],
    env: { TOKEN: "secret" },
    is_active: false,
    updated_at: new Date("2026-01-02T00:00:00.000Z"),
  });
});

test("normalizeMcpTimestamp rejects broken timestamp values", () => {
  assert.equal(normalizeMcpTimestamp({ toDate: () => new Date("invalid") }), null);
  assert.equal(normalizeMcpTimestamp("2026-01-03T00:00:00.000Z"), "2026-01-03T00:00:00.000Z");
});
