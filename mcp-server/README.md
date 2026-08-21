# Rearvy Private MCP Server

This package exposes a small, private MCP server from the existing Rearvy checkout. It is intentionally a **read-only context bridge**: it can inspect approved source and documentation but cannot run shell commands, access secrets, write files, or control the desktop.

That boundary keeps ChatGPT and Codex useful for Rearvy-aware work while keeping OS-changing actions inside the existing Rearvy desktop approval workflow.

## Included tools

- `rearvy_workspace_overview` — reports the Rearvy project structure and access boundary.
- `rearvy_search_workspace` — searches approved text and source files.
- `rearvy_read_workspace_file` — returns a bounded line range from an approved workspace-relative file.
- `rearvy_desktop_execution_policy` — explains the approved desktop execution path.

The server blocks environment files, secrets, credentials, private paths, dependency folders, generated output, binaries, and files larger than 512 KiB.

## Local setup

From this directory:

```powershell
npm install
npm run check
```

## Use with the Rearvy desktop app

Start the stdio server:

```powershell
npm run dev:stdio
```

Register it in Rearvy's MCP settings as a local stdio server:

```json
{
  "name": "Rearvy Private Context",
  "type": "stdio",
  "command": "node",
  "args": ["C:/absolute/path/to/rearvy2.0/mcp-server/dist/stdio.js"]
}
```

Build first when using the `dist` path:

```powershell
npm run build
```

## Use privately with ChatGPT

Start the loopback-only HTTP endpoint:

```powershell
npm run dev:http
```

The endpoint is `http://127.0.0.1:4318/mcp`. It intentionally refuses non-loopback binding unless `REARVY_MCP_ALLOW_NETWORK=true` is set.

For private ChatGPT connectivity, keep the server local and connect it through OpenAI Secure MCP Tunnel. Do not expose this endpoint to the public internet. The tunnel client can reach this loopback endpoint on the same computer.

## Later extraction

This package has its own manifest, source tree, tests, and documentation so it can later be moved into a separate private repository without changing its public MCP interface.
