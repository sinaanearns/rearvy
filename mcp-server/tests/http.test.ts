import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "..");

function randomTestPort(): number {
  return 44_000 + Math.floor(Math.random() * 1_000);
}

async function waitForHealth(url: string, stderr: string[]): Promise<void> {
  const deadline = Date.now() + 7_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The child process is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Timed out waiting for Rearvy MCP HTTP server. ${stderr.join("")}`);
}

test("private HTTP MCP serves the protocol on a loopback endpoint", async () => {
  const port = randomTestPort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const stderr: string[] = [];
  const child = spawn(process.execPath, ["dist/http.js"], {
    cwd: packageRoot,
    env: {
      ...process.env,
      REARVY_MCP_PORT: String(port),
      REARVY_WORKSPACE_ROOT: workspaceRoot,
    },
    stdio: ["ignore", "ignore", "pipe"],
  });
  child.stderr.on("data", (chunk) => stderr.push(String(chunk)));

  try {
    await waitForHealth(baseUrl, stderr);
    const client = new Client({ name: "rearvy-private-mcp-http-test-client", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    await client.connect(transport);
    const tools = await client.listTools();
    assert.ok(tools.tools.some((tool) => tool.name === "rearvy_workspace_overview"));
    await client.close();
  } finally {
    child.kill();
    await new Promise<void>((resolve) => child.once("exit", () => resolve()));
  }
});
