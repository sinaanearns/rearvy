import type { AutomationPolicy } from "@/lib/agent-events/types";

export type AutomationPolicyPatch = Partial<
  Pick<
    AutomationPolicy,
    | "project_id"
    | "layer"
    | "allowed_scopes"
    | "require_approval_for"
    | "desktop_permissions"
    | "rate_limits"
    | "audit_enabled"
  >
>;

const ALLOWED_SCOPES = new Set([
  "insights",
  "memory",
  "integrations.read",
  "gmail.draft",
  "calendar.read",
  "browser.read",
  "filesystem.read",
  "spreadsheets.read",
  "analytics.read",
  "crm.read",
]);

const APPROVAL_SCOPES = new Set([
  "gmail.send",
  "whatsapp.send",
  "stripe.write",
  "shopify.write",
  "crm.write",
  "browser.write",
  "filesystem.write",
  "desktop.app_control",
  "shell.command",
  "wallet.transaction",
]);

function sanitizeStringArray(
  value: unknown,
  allowedValues: Set<string>,
  fallback: string[]
) {
  if (!Array.isArray(value)) {
    return fallback;
  }

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => allowedValues.has(item))
    )
  ).slice(0, 50);
}

function sanitizeLayer(value: unknown): 1 | 2 | 3 | 4 {
  if (value === 1 || value === 2 || value === 3 || value === 4) {
    return value;
  }

  return 1;
}

function sanitizeRateLimit(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(Math.max(Math.floor(value), min), max);
}

function sanitizeDesktopPermissions(value: unknown) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};

  return {
    filesystem: source.filesystem === true,
    appControl: source.appControl === true,
    browserControl: source.browserControl === true,
    shellCommands: false,
  };
}

function ensureMandatoryApprovalScopes(scopes: string[]) {
  return Array.from(new Set([...scopes, "wallet.transaction"]));
}

export function getDefaultAutomationPolicy(userId: string): AutomationPolicy {
  const nowIso = new Date().toISOString();

  return {
    id: userId,
    user_id: userId,
    project_id: null,
    layer: 1,
    allowed_scopes: ["insights", "memory", "integrations.read"],
    require_approval_for: [
      "gmail.send",
      "whatsapp.send",
      "stripe.write",
      "shopify.write",
      "crm.write",
      "browser.write",
      "filesystem.write",
      "desktop.app_control",
      "shell.command",
      "wallet.transaction",
    ],
    desktop_permissions: {
      filesystem: false,
      appControl: false,
      browserControl: false,
      shellCommands: false,
    },
    rate_limits: {
      maxRunsPerHour: 12,
      maxActionsPerRun: 3,
    },
    audit_enabled: true,
    created_at: nowIso,
    updated_at: nowIso,
  };
}

export function normalizeAutomationPolicyPatch(
  patch: AutomationPolicyPatch,
  existing: AutomationPolicy
): AutomationPolicy {
  const sourceRateLimits: Partial<AutomationPolicy["rate_limits"]> =
    patch.rate_limits && typeof patch.rate_limits === "object"
      ? patch.rate_limits
      : {};

  return {
    ...existing,
    project_id:
      typeof patch.project_id === "string" && patch.project_id.trim()
        ? patch.project_id.trim()
        : existing.project_id,
    layer: sanitizeLayer(patch.layer ?? existing.layer),
    allowed_scopes: sanitizeStringArray(
      patch.allowed_scopes,
      ALLOWED_SCOPES,
      existing.allowed_scopes
    ),
    require_approval_for: ensureMandatoryApprovalScopes(
      sanitizeStringArray(
        patch.require_approval_for,
        APPROVAL_SCOPES,
        existing.require_approval_for
      )
    ),
    desktop_permissions: patch.desktop_permissions
      ? sanitizeDesktopPermissions(patch.desktop_permissions)
      : existing.desktop_permissions,
    rate_limits: {
      maxRunsPerHour: sanitizeRateLimit(
        sourceRateLimits.maxRunsPerHour,
        existing.rate_limits.maxRunsPerHour,
        1,
        100
      ),
      maxActionsPerRun: sanitizeRateLimit(
        sourceRateLimits.maxActionsPerRun,
        existing.rate_limits.maxActionsPerRun,
        1,
        25
      ),
    },
    audit_enabled:
      typeof patch.audit_enabled === "boolean"
        ? patch.audit_enabled
        : existing.audit_enabled,
    updated_at: new Date().toISOString(),
  };
}

export function canRunAutomationLayer(
  policy: AutomationPolicy,
  requestedLayer: 1 | 2 | 3 | 4
) {
  return policy.layer >= requestedLayer;
}
