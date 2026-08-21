# Rearvy Private MCP Server

This package is an independent, private MCP server that runs locally beside Rearvy.

- Keep all MCP implementation code inside this folder.
- Treat the parent Rearvy repository as read-only reference material unless a task explicitly requires an integration change.
- Never expose arbitrary shell execution, unrestricted filesystem access, secrets, or direct desktop control as MCP tools.
- Keep desktop-changing work inside Rearvy's existing approval-gated workflow boundary.
- The default HTTP listener must remain loopback-only. Use a secure MCP tunnel for ChatGPT connectivity instead of opening an inbound public port.
- Do not add or copy credentials into this package.
