import assert from "node:assert/strict";
import test, { describe } from "node:test";
import type { McpServerConfig } from "@/lib/firebase/schema";
import {
  extractCapabilitiesFromMcpTool,
  inferMcpToolRisk,
  scoreMcpProvider,
  selectMcpToolForTask,
} from "./capability-graph";

function server(overrides: Partial<McpServerConfig> = {}): McpServerConfig {
  return {
    id: "media_server",
    user_id: "user_1",
    name: "Media connector",
    type: "streamable_http",
    url: "https://mcp.example.com",
    is_active: true,
    capabilities: ["video_editing"],
    health_status: "healthy",
    created_at: null,
    updated_at: null,
    tool_catalog: [
      {
        name: "search_clips",
        description: "Search clips by topic",
        input_schema: { type: "object" },
        capabilities: ["video_editing"],
        risk: "read",
        approval_required: false,
      },
      {
        name: "render_video",
        description: "Render a completed video timeline",
        input_schema: { type: "object" },
        capabilities: ["video_editing"],
        risk: "write",
        approval_required: true,
      },
    ],
    ...overrides,
  };
}

describe("MCP capability matching", () => {
  test("unknown tools do not become document providers", () => {
    assert.deepEqual(extractCapabilitiesFromMcpTool("frobnicate", "Performs a custom action"), []);
  });

  test("unknown and mutating operations fail closed behind approval", () => {
    assert.equal(inferMcpToolRisk("getBoards", "List boards"), "read");
    assert.equal(inferMcpToolRisk("sendEmail", "Send an email"), "publish");
    assert.equal(inferMcpToolRisk("delete_account", "Delete an account"), "destructive");
    assert.equal(inferMcpToolRisk("frobnicate", "Performs a custom action"), "write");
  });

  test("unrelated active servers receive no provider score", () => {
    assert.equal(scoreMcpProvider(server(), "email").score, 0);
    assert.ok(scoreMcpProvider(server(), "video_editing").score > 0);
  });

  test("selects the concrete tested operation that best matches the task", () => {
    const selected = selectMcpToolForTask(
      server(),
      "video_editing",
      "Render the final video timeline"
    );
    assert.equal(selected?.name, "render_video");
  });
});
