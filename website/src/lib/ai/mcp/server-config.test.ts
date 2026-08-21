import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeMcpServerDocument,
  normalizeMcpTimestamp,
  normalizeNewMcpServer,
  readMcpUrl,
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

test("normalizes Streamable HTTP metadata and tested tool catalog", () => {
  const server = normalizeMcpServerDocument("remote_1", {
    user_id: "user_1",
    name: "Media tools",
    type: "streamable_http",
    url: "https://mcp.example.com/v1",
    capabilities: [" video_editing ", 3, "search"],
    permissions: ["clips:read"],
    health_status: "healthy",
    latency_ms: 125,
    tool_catalog: [
      {
        name: " search_clips ",
        description: "Search existing clips",
        input_schema: { type: "object", required: ["query"] },
        capabilities: ["video_editing", "search"],
        risk: "read",
        approval_required: true,
      },
      {
        name: "publish_clip",
        capabilities: ["social_media"],
        risk: "publish",
        approval_required: false,
      },
    ],
  });

  assert.equal(server.type, "streamable_http");
  assert.equal(server.url, "https://mcp.example.com/v1");
  assert.deepEqual(server.capabilities, ["video_editing", "search"]);
  assert.equal(server.tool_catalog?.[0]?.approval_required, false);
  assert.equal(server.tool_catalog?.[1]?.approval_required, true);
});

test("remote MCP URLs reject embedded credentials and unsupported protocols", () => {
  assert.equal(readMcpUrl("https://user:secret@example.com/mcp"), "");
  assert.equal(readMcpUrl("file:///tmp/mcp"), "");
  assert.equal(readMcpUrl("https://example.com/mcp"), "https://example.com/mcp");
});
