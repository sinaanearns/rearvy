#!/usr/bin/env node
/**
 * Blender MCP SSE Bridge
 * Connects to blender-mcp via SSE/HTTP or stdio and exposes a local bridge HTTP API.
 *
 * Usage:
 *   node scripts/blender-mcp-bridge.mjs [--port 3001] [--mcp-url http://localhost:4001/mcp]
 */

import { createServer } from "http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const PORT = process.argv.includes("--port")
  ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
  : 3001;

const MCP_URL = process.argv.includes("--mcp-url")
  ? process.argv[process.argv.indexOf("--mcp-url") + 1]
  : process.env.BLENDER_MCP_URL;

let mcpClient = null;
let mcpTransport = null;

async function startBlenderMcp() {
  if (MCP_URL) {
    const url = new URL(MCP_URL);
    console.log(`Connecting to external Blender MCP SSE/HTTP server at ${url}`);
    await connectMcpClient(url);
    console.log(`Connected to blender-mcp via SSE/HTTP at ${url}`);
    return;
  }

  console.log("Starting blender-mcp process with stdio transport...");
  const transport = new StdioClientTransport({
    command: "uvx",
    args: ["blender-mcp"],
    stderr: "pipe",
    env: { ...process.env },
  });

  if (transport.stderr) {
    transport.stderr.on("data", (data) => {
      console.error(`[blender-mcp stderr] ${data}`);
    });
  }

  await mcpClientConnect(transport);
  console.log("Connected to blender-mcp via stdio");
}

async function connectMcpClient(mcpUrl) {
  const transport = new SSEClientTransport(new URL(mcpUrl));
  await mcpClientConnect(transport);
}

async function mcpClientConnect(transport) {
  mcpClient = new Client(
    { name: "BlenderMCP-SSE-Bridge", version: "1.0.0" },
    { capabilities: {} }
  );

  mcpTransport = transport;
  await mcpClient.connect(transport);
  console.log("MCP client connected");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(200);
    res.end();
    return;
  }

  if (pathname === "/sse" && req.method === "GET") {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    res.write("data: {\"type\":\"connected\",\"message\":\"SSE bridge ready\"}\n\n");

    const interval = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 30000);

    req.on("close", () => {
      clearInterval(interval);
      res.end();
    });

    return;
  }

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
      res.end(JSON.stringify({ error: error instanceof Error ? error.message : String(error) }));
    }

    return;
  }

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

        console.log(`[BRIDGE] Calling tool: ${toolName} with args:`, JSON.stringify(args, null, 2));

        const result = await mcpClient.callTool({
          name: toolName,
          arguments: args || {},
        });

        console.log(`[BRIDGE] Tool ${toolName} completed successfully`);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (error) {
        console.error(`[BRIDGE] Failed to call tool ${JSON.parse(body).toolName || 'unknown'}:`, error);
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({
          error: error instanceof Error ? error.message : String(error),
          toolName: JSON.parse(body).toolName || 'unknown',
          timestamp: new Date().toISOString()
        }));
      }
    });

    return;
  }

  if (pathname === "/health" && req.method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ status: "ok", connected: !!mcpClient }));
    return;
  }

  res.writeHead(404, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Not found" }));
});

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

    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      server.close();
      if (mcpClient) {
        try {
          await mcpClient.close();
        } catch (error) {
          console.error("Error closing MCP client:", error);
        }
      }
      process.exit(0);
    });
  } catch (error) {
    console.error("Failed to start bridge:", error);
    process.exit(1);
  }
}

main();
