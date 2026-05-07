#!/usr/bin/env node
/**
 * Blender MCP SSE Bridge
 * Wraps the stdio blender-mcp server and exposes it as an HTTP SSE server.
 * 
 * Usage:
 *   node scripts/blender-mcp-bridge.mjs [--port 3001]
 */

import { spawn } from "child_process";
import { createServer } from "http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const PORT = process.argv.includes("--port")
  ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
  : 3001;

const MCP_URL = process.argv.includes("--mcp-url")
  ? process.argv[process.argv.indexOf("--mcp-url") + 1]
  : process.env.BLENDER_MCP_URL || "http://127.0.0.1:4001";

let mcpClient = null;
let mcpProcess = null;

async function waitForMcpServer(url) {
  const healthUrl = new URL("/health", url);
  const deadline = Date.now() + 10000;

  while (Date.now() < deadline) {
    try {
      const res = await fetch(healthUrl);
      if (res.ok) {
        return;
      }
    } catch {
      // ignore failures until ready
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(`Timed out waiting for Blender MCP server at ${healthUrl}`);
}

async function startBlenderMcp() {
  const mcpUrl = new URL(MCP_URL);
  const shouldSpawn = !process.argv.includes("--mcp-url") && !process.env.BLENDER_MCP_URL;

  if (shouldSpawn) {
    console.log("Starting blender-mcp process for SSE/HTTP transport...");
    mcpProcess = spawn("uvx", ["blender-mcp"], {
      stdio: ["ignore", "pipe", "pipe"],
      shell: true,
    });

    mcpProcess.stderr.on("data", (data) => {
      console.error(`[blender-mcp stderr] ${data}`);
    });

    mcpProcess.on("error", (err) => {
      console.error("Failed to start blender-mcp:", err);
    });

    mcpProcess.on("exit", (code) => {
      console.log(`blender-mcp process exited with code ${code}`);
      process.exit(1);
    });
  } else {
    console.log(`Using external Blender MCP server at ${mcpUrl}`);
  }

  await waitForMcpServer(mcpUrl);
  await connectMcpClient(mcpUrl);
  console.log(`Connected to blender-mcp via SSE/HTTP at ${mcpUrl}`);
}

async function connectMcpClient(mcpUrl) {
  mcpClient = new Client(
    { name: "BlenderMCP-SSE-Bridge", version: "1.0.0" },
    { capabilities: {} }
  );

  const transport = new SSEClientTransport(new URL(mcpUrl));
  await mcpClient.connect(transport);
  console.log("MCP client connected");
}

// HTTP SSE Server
const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Enable CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  // SSE endpoint for tool calls
  if (pathname === "/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Send initial connection event
    res.write("data: {\"type\":\"connected\",\"message\":\"SSE bridge ready\"}\n\n");

    // Keep connection alive
    const interval = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });

    return;
  }

  // Tool listing endpoint
  if (pathname === "/tools" && req.method === "GET") {
    if (!mcpClient) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "MCP client not connected" }));
      return;
    }

    try {
      const result = await mcpClient.listTools();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (error) {
      console.error("Failed to list tools:", error);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: error.message }));
    }

    return;
  }

  // Tool call endpoint
  if (pathname === "/call" && req.method === "POST") {
    if (!mcpClient) {
      res.writeHead(503, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "MCP client not connected" }));
      return;
    }

    let body = "";
    req.on("data", (chunk) => {
      body += chunk.toString();
    });

    req.on("end", async () => {
      try {
        const { toolName, arguments: args } = JSON.parse(body);

        if (!toolName) {
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Missing toolName" }));
          return;
        }

        const result = await mcpClient.callTool({
          name: toolName,
          arguments: args || {},
        });

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error("Failed to call tool:", error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: error.message }));
      }
    });

    return;
  }

  // Health check
  if (pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", connected: !!mcpClient }));
    return;
  }

  // 404
  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

// Start everything
async function main() {
  try {
    await startBlenderMcp();

    server.listen(PORT, () => {
      console.log(`✓ Blender MCP SSE Bridge listening on http://localhost:${PORT}`);
      console.log(`  - SSE: http://localhost:${PORT}/sse`);
      console.log(`  - Tools: http://localhost:${PORT}/tools`);
      console.log(`  - Call: POST http://localhost:${PORT}/call`);
      console.log(`  - Health: http://localhost:${PORT}/health`);
    });

    process.on("SIGINT", () => {
      console.log("\nShutting down...");
      server.close();
      if (mcpProcess) mcpProcess.kill();
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start bridge:", error);
    process.exit(1);
  }
}

main();
