# Rearvy Connector Contract

Rearvy is a universal orchestration layer. A connected platform contributes a
private connector that exposes a bounded set of capabilities; it does not
upload or publish the platform's source code.

## Integration lifecycle

1. A platform owner registers the platform in the Rearvy Integration Portal.
2. Rearvy generates a manifest, capability Markdown file, adapter plan, and
   sandbox tests.
3. The owner adds the adapter to the private platform codebase and reviews the
   proposed changes.
4. The owner runs the connector in the sandbox and submits only the connector
   package and manifest to Rearvy.
5. Rearvy validates the manifest, permission scopes, tests, and security
   boundary before activation.
6. Users can connect their account and invoke only the capabilities they have
   approved.

The persisted lifecycle is deliberately one-way for publishers:

`draft` -> `sandbox` -> `in_review` -> `verified` -> `published`

- A publisher may create a draft, run contract validation, submit sandbox
  access or local test instructions, and return an unverified submission to
  draft.
- A publisher cannot mark its own connector verified or published. Those
  transitions require a Rearvy reviewer authenticated with an admin custom
  claim (or an explicitly configured admin UID).
- `sandbox` means the manifest contract passed and the connector is ready for
  sandbox evaluation. It does not claim the remote adapter has passed runtime
  tests yet.
- `published` connectors appear in the catalog only when their requested
  visibility is `catalog`. A published private connector remains private.

## Required artifacts

- `rearvy.manifest.json`: machine-readable connector contract.
- `rearvy.capabilities.md`: human- and coding-agent-readable explanation.
- Adapter implementation: the platform-specific API, bridge, extension, or
  MCP transport.
- Contract tests: input validation, permission checks, error handling, and
  safe disconnect behavior.

The Markdown file is documentation and planning context. It is not an
execution permission and cannot connect a platform by itself.

## Capability rules

- Read capabilities may run without per-action approval when the user has
  granted the connector's read scope.
- Write, publish, and destructive capabilities must declare approval.
- Credentials, source code, and customer data must remain outside the
  capability manifest.
- External capabilities must be labelled as external and must not be treated
  as native host-application functions.

The initial TypeScript schema and Markdown renderer live in
`website/src/lib/rearvy-connectors/manifest.ts`.

## Connection methods

API keys, OAuth, MCP, and npm do different jobs:

- OAuth or an API key authorizes Rearvy to access a specific user account.
- MCP, a direct API adapter, webhook, browser extension, or local bridge is the
  execution transport.
- An npm package is an implementation or SDK distribution method. Installing a
  package does not authorize an account or connect a platform by itself.
- New remote MCP connectors should use Streamable HTTP. Legacy SSE remains
  supported during migration, and stdio is limited to a trusted local Rearvy
  runtime.

## Truthful workflow execution

Rearvy assigns only operations discovered during a connector health test. A
workflow step stores the connector, concrete operation, schema, risk,
dependencies, approval policy, and idempotency key. The workflow executor calls
that operation and stores the returned connector payload. Model-generated prose
is never accepted as proof that an external action completed.

Safe independent steps may execute in parallel. Write, publish, and destructive
operations wait for approval. Missing connectors and missing inputs pause only
their dependent branch, while failures block downstream steps and remain
visible in the workflow record.
