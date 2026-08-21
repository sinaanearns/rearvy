import { z } from "zod";

/**
 * The transport used by a connector. A connector may be private and still
 * use any of these transports; this describes how Rearvy reaches it, not who
 * can see its source code.
 */
export const connectorTransportSchema = z.enum([
  "oauth_api",
  "api_key",
  "webhook",
  "local_bridge",
  "browser_extension",
  "mcp",
]);

export const capabilityRiskSchema = z.enum(["read", "write", "publish", "destructive"]);

const identifierSchema = z
  .string()
  .trim()
  .regex(/^[a-z][a-z0-9._-]*$/, "Must start with a lowercase letter and contain only a-z, 0-9, '.', '_' or '-'.");

const jsonSchemaFragment = z.record(z.string(), z.unknown());

export const connectorCapabilitySchema = z.object({
  id: identifierSchema,
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().min(1).max(500),
  risk: capabilityRiskSchema,
  approvalRequired: z.boolean(),
  inputSchema: jsonSchemaFragment.default({ type: "object", properties: {} }),
  outputSchema: jsonSchemaFragment.default({ type: "object" }),
});

export const connectorManifestSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id: identifierSchema,
    displayName: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(500),
    version: z.string().trim().regex(/^\d+\.\d+\.\d+$/, "Must use semantic versioning."),
    publisher: z.string().trim().min(1).max(160),
    transport: connectorTransportSchema,
    privacy: z.literal("private"),
    capabilities: z.array(connectorCapabilitySchema).min(1).max(100),
    requiredScopes: z.array(identifierSchema).max(100).default([]),
    webhookEvents: z.array(identifierSchema).max(100).default([]),
  })
  .superRefine((manifest, context) => {
    const ids = manifest.capabilities.map((capability) => capability.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: "custom",
        path: ["capabilities"],
        message: "Capability IDs must be unique within a connector.",
      });
    }

    manifest.capabilities.forEach((capability, index) => {
      if (capability.risk === "read" && capability.approvalRequired) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", index, "approvalRequired"],
          message: "Read capabilities should not require approval by default.",
        });
      }

      if (capability.risk !== "read" && !capability.approvalRequired) {
        context.addIssue({
          code: "custom",
          path: ["capabilities", index, "approvalRequired"],
          message: "Write, publish, and destructive capabilities require approval.",
        });
      }
    });
  });

export type ConnectorCapability = z.infer<typeof connectorCapabilitySchema>;
export type ConnectorManifest = z.infer<typeof connectorManifestSchema>;
export type ConnectorTransport = z.infer<typeof connectorTransportSchema>;

export function validateConnectorManifest(value: unknown) {
  return connectorManifestSchema.safeParse(value);
}

function markdownList(items: string[]) {
  return items.length > 0 ? items.map((item) => `- \`${item}\``).join("\n") : "- None";
}

/**
 * Generates the human-readable file that coding agents can inspect. It
 * deliberately labels capabilities as external so they cannot be mistaken
 * for native features of the host codebase.
 */
export function renderCapabilitiesMarkdown(manifest: ConnectorManifest) {
  const capabilities = manifest.capabilities
    .map(
      (capability) =>
        `### ${capability.name} (` +
        `\`${capability.id}\`)\n\n` +
        `${capability.description}\n\n` +
        `- Risk: \`${capability.risk}\`\n` +
        `- Approval required: \`${capability.approvalRequired ? "yes" : "no"}\`\n`
    )
    .join("\n");

  return `# Rearvy Connected Capabilities

> This file describes an external platform connected to Rearvy. These are **not native features of this codebase**. They are available only through the approved Rearvy connector.

## Platform

- Name: ${manifest.displayName}
- Connector ID: \`${manifest.id}\`
- Connector version: \`${manifest.version}\`
- Publisher: ${manifest.publisher}
- Transport: \`${manifest.transport}\`
- Source visibility: \`${manifest.privacy}\`

## External capabilities

${capabilities}
## Permissions

Required scopes:

${markdownList(manifest.requiredScopes)}

Webhook events:

${markdownList(manifest.webhookEvents)}

## Instructions for coding agents

1. Treat the capabilities above as external integration actions, not local application APIs.
2. Inspect the host codebase before proposing changes.
3. Explain which Rearvy adapter, authentication, and permission checks are required.
4. Keep connector code separate from the host application's core business logic.
5. Request user approval before write, publish, or destructive actions.
6. Do not upload source code, credentials, or customer data to Rearvy.
7. Produce a plan and tests before implementing the integration.
`;
}

