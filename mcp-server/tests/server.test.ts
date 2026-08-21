import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "..");

async function withClient(run: (client: Client) => Promise<void>) {
  const client = new Client({ name: "rearvy-private-mcp-test-client", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/stdio.ts"],
    cwd: packageRoot,
    env: { ...process.env, REARVY_WORKSPACE_ROOT: workspaceRoot },
    stderr: "pipe",
  });

  await client.connect(transport);
  try {
    await run(client);
  } finally {
    await client.close();
  }
}

test("private MCP exposes only the intended read-only tools", async () => {
  await withClient(async (client) => {
    const result = await client.listTools();
    assert.deepEqual(
      result.tools.map((tool) => tool.name).sort(),
      [
        "rearvy_desktop_execution_policy",
        "rearvy_read_workspace_file",
        "rearvy_search_workspace",
        "rearvy_workspace_overview",
      ]
    );
  });
});

test("private MCP blocks sensitive workspace paths", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "rearvy_read_workspace_file",
      arguments: { path: ".env.local" },
    });
    assert.equal(result.isError, true);
  });
});

test("private MCP can inspect approved Rearvy documentation", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "rearvy_read_workspace_file",
      arguments: { path: "README.md", startLine: 1, maxLines: 5 },
    });
    assert.equal(result.isError, undefined);
    const textContent = result.content.find((item) => item.type === "text");
    assert.ok(textContent && "text" in textContent && textContent.text.includes("Rearvy"));
  });
});

test("private MCP searches approved workspace text", async () => {
  await withClient(async (client) => {
    const result = await client.callTool({
      name: "rearvy_search_workspace",
      arguments: { query: "AI Business Operating System" },
    });
    assert.equal(result.isError, undefined);
    const textContent = result.content.find((item) => item.type === "text");
    assert.ok(textContent && "text" in textContent && textContent.text.includes("README.md"));
  });
});
