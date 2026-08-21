import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createRearvyMcpServer } from "./server.js";

async function main() {
  const server = createRearvyMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("Rearvy private MCP server is running over stdio.\n");
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`Rearvy MCP server failed to start: ${message}\n`);
  process.exitCode = 1;
});
