/**
 * Helper to structure and refine raw user platform descriptions into
 * enterprise-grade Rearvy Connector Briefs and AI Agent Specifications.
 */

export function cleanCapabilityItems(rawText: string): string[] {
  if (!rawText.trim()) return [];

  // Split on newlines, bullet points, or semicolons/periods that indicate discrete features
  const lines = rawText
    .split(/\r?\n|•|;/)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter((s) => s.length > 2);

  if (lines.length > 1) {
    return lines;
  }

  // If provided as a single long run-on paragraph, attempt to segment by connective phrases
  const single = rawText.trim();
  const segmented = single
    .split(/(?<=[.?!])\s+|,\s*(?:then|and\s+it|also\s+has|proceeded\s+on)\s+/i)
    .map((s) => s.trim().replace(/^[-*•\d.)\s]+/, ""))
    .filter((s) => s.length > 4);

  return segmented.length > 0 ? segmented : [single];
}

/**
 * Generates an enterprise-ready Rearvy Connector Brief from platform type and description.
 * Used as high-fidelity output and reliable deterministic fallback when AI keys are offline.
 */
export function generateStructuredConnectorBrief(
  platformType: string,
  rawDescription: string
): string {
  const items = cleanCapabilityItems(rawDescription);

  // Extract domain or platform name if present (e.g. cliping.com -> Cliping.com)
  const domainMatch = rawDescription.match(/\b([a-z0-9-]+\.(?:com|org|net|io|ai|co|app|dev|sh))\b/i);
  const detectedName = domainMatch ? domainMatch[1] : `${platformType} Integration`;

  const capabilityBulletList =
    items.length > 0
      ? items
          .map((item, index) => {
            const clean = item.charAt(0).toUpperCase() + item.slice(1);
            return `### Capability ${index + 1}: ${clean.length > 60 ? clean.slice(0, 57) + "…" : clean}\n- **Description**: ${clean}\n- **Execution Mode**: Sandboxed external action\n- **Approval Policy**: ${
              /edit|upload|delete|create|post|schedule|transact|send|publish/i.test(item)
                ? "Human approval required before execution"
                : "Automated read/query"
            }`;
          })
          .join("\n\n")
      : `### Primary Capability\n- **Description**: ${rawDescription.trim()}\n- **Execution Mode**: Sandboxed external action\n- **Approval Policy**: Human approval required`;

  return `# Rearvy Connector Brief & AI Specification

## 1. Platform Overview
- **Platform Name**: ${detectedName}
- **Platform Type**: ${platformType || "Website"}
- **Source Visibility**: Private (Zero source code, internal business logic, or customer credentials are leaked to Rearvy)
- **Target Specification Artifact**: \`rearvy.capabilities.md\`

## 2. Core Value Proposition & Scope
> ${rawDescription.trim()}

## 3. Discovered External Capabilities & Action Contract
${capabilityBulletList}

## 4. Integration & Security Blueprint
1. **Private Adapter Implementation**:
   - Implement a lightweight, sandboxed adapter interface within your platform codebase.
   - Expose explicit JSON schema payloads for inputs, outputs, and status webhooks.
2. **Permission Boundary & Scopes**:
   - Limit connector execution scope strictly to approved actions.
   - Separate read-only query capabilities from destructive or write capabilities.
3. **Human-in-the-Loop Safeguards**:
   - Require explicit user confirmation in the Rearvy dashboard before committing outbound uploads, video generation, or publishing actions.
4. **Sandbox & Regression Testing**:
   - Run automated sandbox tests against mock fixtures before requesting connector verification.
   - Ensure rate limiting and timeout tolerance (recommended 30s timeout per invocation).
5. **Zero-Trust Data Policy**:
   - Do not transmit proprietary tokens, internal database connection strings, or unencrypted customer PII to Rearvy.

## 5. Instructions for AI Coding Agents (Cursor / Claude / Copilot)
When implementing the private Rearvy connector for this platform:
- Read \`rearvy.capabilities.md\` to understand the external boundaries.
- Treat external capabilities as remote integrations, not native host methods.
- Write modular adapter handlers in \`src/connectors/\` or equivalent isolated boundary.
- Generate end-to-end integration tests validating error handling and payload formatting.
`;
}
