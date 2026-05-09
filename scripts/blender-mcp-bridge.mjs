#!/usr/bin/env node
/**
 * Blender MCP SSE Bridge
 * Connects to blender-mcp via SSE/HTTP or stdio and exposes a local bridge HTTP API.
 *
 * Usage:
 *   node scripts/blender-mcp-bridge.mjs [--port 3001] [--mcp-url http://localhost:4001/mcp]
 */

import { createServer, request as httpRequest } from "http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const PORT = process.argv.includes("--port")
  ? parseInt(process.argv[process.argv.indexOf("--port") + 1], 10)
  : 3001;

const MCP_URL = process.argv.includes("--mcp-url")
  ? process.argv[process.argv.indexOf("--mcp-url") + 1]
  : process.env.BLENDER_MCP_URL;

console.log(`[Bridge] BLENDER_EXECUTABLE: ${process.env.BLENDER_EXECUTABLE || '(not set)'} `);

let mcpClient = null;
let mcpTransport = null;

function checkBridgeHealth(port) {
  return new Promise((resolve) => {
    const healthReq = httpRequest(
      {
        hostname: "127.0.0.1",
        port,
        path: "/health",
        method: "GET",
        timeout: 1500,
      },
      (res) => {
        let body = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            const parsed = JSON.parse(body);
            resolve(Boolean(parsed && parsed.status === "ok" && parsed.connected));
          } catch {
            resolve(false);
          }
        });
      }
    );

    healthReq.on("error", () => resolve(false));
    healthReq.on("timeout", () => {
      healthReq.destroy();
      resolve(false);
    });
    healthReq.end();
  });
}

async function startBlenderMcp() {
  if (MCP_URL) {
    const url = new URL(MCP_URL);
    console.log(`Connecting to external Blender MCP SSE/HTTP server at ${url}`);
    await connectMcpClient(url);
    console.log(`Connected to blender-mcp via SSE/HTTP at ${url}`);
    return;
  }

  console.log("Starting blender-mcp process with stdio transport...");
  // Try multiple possible commands to invoke blender-mcp. Allow override via
  // BLENDER_MCP_CMD environment variable for systems where `uvx` is unavailable.
  const osType = require("os").type();
  const isWindows = osType === "Windows_NT";
  
  // Build command candidates with Windows support
  const candidates = [
    process.env.BLENDER_MCP_CMD,
    // Windows: try Python module first
    isWindows ? "python" : null,
    isWindows ? "python3" : null,
    "uvx",
    "blender-mcp",
  ].filter(Boolean);

  console.log(`[Bridge] OS: ${osType}, Command candidates: ${candidates.join(", ")}`);
  // Prepare environment for subprocesses. If BLENDER_EXECUTABLE is set,
  // ensure its directory is on PATH so subprocesses that call `blender`
  // can resolve the binary by name.
  const path = require("path");
  const bridgeEnv = { ...process.env };
  if (process.env.BLENDER_EXECUTABLE) {
    try {
      const blenderDir = path.dirname(process.env.BLENDER_EXECUTABLE);
      const currentPath = bridgeEnv.PATH || bridgeEnv.Path || "";
      // Prepend blenderDir to PATH if not already present
      if (!currentPath.split(path.delimiter).includes(blenderDir)) {
        bridgeEnv.PATH = `${blenderDir}${path.delimiter}${currentPath}`;
      }
    } catch (e) {
      console.error("[Bridge] Failed to normalize BLENDER_EXECUTABLE path:", e?.message || e);
    }
  }

  let lastError = null;
  for (const cmd of candidates) {
    let args = [];
    
    if (cmd === "python" || cmd === "python3") {
      args = ["-m", "blender_mcp"];
      console.log(`Attempting to start blender-mcp using command: ${cmd} ${args.join(" ")}`);
    } else if (cmd === "uvx") {
      args = ["blender-mcp"];
      console.log(`Attempting to start blender-mcp using command: ${cmd} ${args.join(" ")}`);
    } else {
      console.log(`Attempting to start blender-mcp using command: ${cmd}`);
    }

    const transport = new StdioClientTransport({
      command: cmd,
      args,
      stderr: "pipe",
      env: bridgeEnv,
    });

    if (transport.stderr) {
      transport.stderr.on("data", (data) => {
        console.error(`[blender-mcp stderr] ${data}`);
      });
    }

    try {
      await mcpClientConnect(transport);
      console.log(`✓ Connected to blender-mcp via stdio (command: ${cmd})`);
      lastError = null;
      break;
    } catch (err) {
      console.error(`✗ Failed to start blender-mcp with command ${cmd}:`, err?.message || err);
      lastError = err;
      // continue to next candidate
    }
  }

  if (lastError) {
    console.error("[Bridge] All blender-mcp command candidates failed. Last error:", lastError?.message);
    throw new Error(
      "Could not start blender-mcp. Ensure it is installed:\n" +
      "  - Via pip: pip install blender-mcp\n" +
      "  - Via uv: uvx blender-mcp (requires uv)\n" +
      "  - Set BLENDER_MCP_CMD env var for custom location.\n" +
      `Last error: ${lastError?.message || lastError}`
    );
  }
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

    server.on("error", async (error) => {
      if (error?.code === "EADDRINUSE") {
        const healthy = await checkBridgeHealth(PORT);
        if (healthy) {
          console.log(`✓ Blender MCP SSE Bridge already running on http://localhost:${PORT}`);
          process.exit(0);
          return;
        }
      }

      console.error("Failed to start bridge server:", error);
      process.exit(1);
    });

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
