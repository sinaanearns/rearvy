import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import {
  getWorkspaceOverview,
  readWorkspaceTextFile,
  searchWorkspace,
} from "./workspace.js";

const SERVER_NAME = "rearvy-private-mcp";
const SERVER_VERSION = "0.1.0";

function jsonResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2),
      },
    ],
  };
}

function toolError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected MCP tool error.";
  return {
    isError: true,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createRearvyMcpServer(): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "Rearvy is a private, read-only workspace context bridge. Use its tools to inspect approved Rearvy source and documentation. Never request secrets, environment files, arbitrary filesystem access, shell execution, or direct desktop control. For desktop-changing work, direct the user to Rearvy's approval-gated desktop workflows.",
    }
  );

  server.registerTool(
    "rearvy_workspace_overview",
    {
      title: "Rearvy workspace overview",
      description: "Returns the high-level Rearvy project structure and the MCP server's access boundaries.",
      annotations: { readOnlyHint: true },
    },
    async () => {
      try {
        return jsonResult(await getWorkspaceOverview());
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "rearvy_search_workspace",
    {
      title: "Search Rearvy workspace",
      description:
        "Searches approved text and source files inside the Rearvy workspace. Excludes environment files, credentials, private directories, dependencies, and build output.",
      inputSchema: {
        query: z.string().min(2).max(200).describe("Literal text to find in approved Rearvy workspace files."),
        pathPrefix: z.string().max(240).optional().describe("Optional workspace-relative directory to search, such as website/src or desktop-app/lib."),
        maxResults: z.number().int().min(1).max(50).optional().describe("Maximum number of matching lines to return."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ query, pathPrefix, maxResults }) => {
      try {
        return jsonResult({ matches: await searchWorkspace(query, pathPrefix, maxResults) });
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "rearvy_read_workspace_file",
    {
      title: "Read Rearvy workspace file",
      description:
        "Reads a bounded line range from an approved workspace-relative text or source file. Environment files, credentials, private paths, binaries, and large files are blocked.",
      inputSchema: {
        path: z.string().min(1).max(320).describe("Workspace-relative path, for example website/src/lib/ai/mcp/hub.ts."),
        startLine: z.number().int().min(1).optional().describe("First line to return. Defaults to 1."),
        maxLines: z.number().int().min(1).max(500).optional().describe("Maximum lines to return. Defaults to 250."),
      },
      annotations: { readOnlyHint: true },
    },
    async ({ path, startLine, maxLines }) => {
      try {
        return jsonResult(await readWorkspaceTextFile(path, startLine, maxLines));
      } catch (error) {
        return toolError(error);
      }
    }
  );

  server.registerTool(
    "rearvy_desktop_execution_policy",
    {
      title: "Rearvy desktop execution policy",
      description: "Explains the boundary for local desktop actions available through Rearvy.",
      annotations: { readOnlyHint: true },
    },
    async () =>
      jsonResult({
        directDesktopControl: "disabled",
        approvedPath: "Submit a complete workflow in the Rearvy desktop application, then obtain user approval before OS-changing actions execute.",
        allowedFromThisMcp: "read-only project context only",
      })
  );

  return server;
}

export const rearvyMcpMetadata = {
  name: SERVER_NAME,
  version: SERVER_VERSION,
  endpoint: "/mcp",
};
