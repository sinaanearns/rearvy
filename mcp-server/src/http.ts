import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createRearvyMcpServer, rearvyMcpMetadata } from "./server.js";

const MAX_REQUEST_BYTES = 1024 * 1024;

function resolvePort(): number {
  const rawPort = process.env.REARVY_MCP_PORT || "4318";
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("REARVY_MCP_PORT must be a valid TCP port.");
  }
  return port;
}

function resolveHost(): string {
  const host = process.env.REARVY_MCP_HOST?.trim() || "127.0.0.1";
  const isLoopback = host === "127.0.0.1" || host === "localhost" || host === "::1";
  if (!isLoopback && process.env.REARVY_MCP_ALLOW_NETWORK !== "true") {
    throw new Error("Refusing a non-loopback MCP listener. Set REARVY_MCP_ALLOW_NETWORK=true only behind a trusted proxy.");
  }
  return host;
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > MAX_REQUEST_BYTES) {
      throw new Error("MCP request body exceeds the 1 MiB limit.");
    }
    chunks.push(buffer);
  }

  if (chunks.length === 0) {
    throw new Error("MCP requests must include a JSON body.");
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

function sendMethodNotAllowed(response: ServerResponse): void {
  sendJson(response, 405, {
    jsonrpc: "2.0",
    error: { code: -32000, message: "Method not allowed." },
    id: null,
  });
}

async function handleMcpPost(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const server = createRearvyMcpServer();
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  let cleanedUp = false;

  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }
    cleanedUp = true;
    await Promise.allSettled([transport.close(), server.close()]);
  };

  response.once("close", () => {
    void cleanup();
  });

  try {
    const body = await readJsonBody(request);
    await server.connect(transport);
    await transport.handleRequest(request, response, body);
  } catch (error) {
    if (!response.headersSent) {
      const message = error instanceof Error ? error.message : "Internal server error.";
      sendJson(response, 500, {
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      });
    }
    if (response.writableEnded || response.destroyed) {
      await cleanup();
    }
  }
}

async function main() {
  const port = resolvePort();
  const host = resolveHost();
  const httpServer = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || host}`);
    if (url.pathname === "/health" && request.method === "GET") {
      sendJson(response, 200, { status: "ok", server: rearvyMcpMetadata.name, version: rearvyMcpMetadata.version });
      return;
    }
    if (url.pathname !== rearvyMcpMetadata.endpoint) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }
    if (request.method !== "POST") {
      sendMethodNotAllowed(response);
      return;
    }
    void handleMcpPost(request, response);
  });

  httpServer.listen(port, host, () => {
    process.stderr.write(`Rearvy private MCP HTTP server listening on http://${host}:${port}${rearvyMcpMetadata.endpoint}\n`);
  });

  const shutdown = () => {
    httpServer.close(() => process.exit(0));
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`Rearvy MCP HTTP server failed to start: ${message}\n`);
  process.exitCode = 1;
});
