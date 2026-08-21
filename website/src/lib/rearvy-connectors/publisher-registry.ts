import { z } from "zod";
import type {
  ConnectorDefinitionRecord,
  ConnectorLifecycleStatus,
} from "@/lib/firebase/schema";
import {
  validateConnectorManifest,
  type ConnectorManifest,
} from "./manifest";

export const connectorVisibilitySchema = z.enum(["private", "catalog"]);
export const connectorLifecycleActionSchema = z.enum([
  "validate_contract",
  "submit_review",
  "return_to_draft",
]);
export const connectorReviewActionSchema = z.enum(["verify", "publish", "reject", "suspend"]);

export type ConnectorLifecycleAction = z.infer<typeof connectorLifecycleActionSchema>;
export type ConnectorReviewAction = z.infer<typeof connectorReviewActionSchema>;

export interface ConnectorContractValidation {
  passed: boolean;
  validated_at: string;
  errors: string[];
  manifest?: ConnectorManifest;
}

export function validateConnectorContract(
  value: unknown,
  now = new Date()
): ConnectorContractValidation {
  const result = validateConnectorManifest(value);
  if (result.success) {
    return {
      passed: true,
      validated_at: now.toISOString(),
      errors: [],
      manifest: result.data,
    };
  }

  return {
    passed: false,
    validated_at: now.toISOString(),
    errors: result.error.issues.map((issue) => {
      const path = issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
      return `${path}${issue.message}`;
    }),
  };
}

export function createConnectorDefinitionId(
  publisherUserId: string,
  connectorId: string,
  version: string
) {
  return `${publisherUserId}__${connectorId}__${version.replaceAll(".", "_")}`;
}

export function canApplyConnectorLifecycleAction(
  status: ConnectorLifecycleStatus,
  action: ConnectorLifecycleAction
) {
  if (action === "validate_contract") return status === "draft" || status === "sandbox";
  if (action === "submit_review") return status === "sandbox";
  return status === "sandbox" || status === "in_review";
}

export function nextConnectorLifecycleStatus(
  status: ConnectorLifecycleStatus,
  action: ConnectorLifecycleAction
): ConnectorLifecycleStatus {
  if (!canApplyConnectorLifecycleAction(status, action)) {
    throw new Error(`Action '${action}' is not allowed while the connector is '${status}'.`);
  }
  if (action === "validate_contract") return "sandbox";
  if (action === "submit_review") return "in_review";
  return "draft";
}

export function nextConnectorReviewStatus(
  status: ConnectorLifecycleStatus,
  action: ConnectorReviewAction
): ConnectorLifecycleStatus {
  if (action === "verify" && status === "in_review") return "verified";
  if (action === "publish" && status === "verified") return "published";
  if (action === "reject" && status === "in_review") return "draft";
  if (action === "suspend" && (status === "verified" || status === "published")) {
    return "suspended";
  }
  throw new Error(`Review action '${action}' is not allowed while the connector is '${status}'.`);
}

export function readSandboxSubmission(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { endpoint: null, test_instructions: null };
  }
  const record = value as Record<string, unknown>;
  const endpointRaw = typeof record.endpoint === "string" ? record.endpoint.trim() : "";
  const instructionsRaw =
    typeof record.test_instructions === "string" ? record.test_instructions.trim() : "";
  let endpoint: string | null = null;

  if (endpointRaw) {
    try {
      const url = new URL(endpointRaw);
      if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
        endpoint = url.toString();
      }
    } catch {
      endpoint = null;
    }
  }

  return {
    endpoint,
    test_instructions: instructionsRaw ? instructionsRaw.slice(0, 4_000) : null,
  };
}

export function hasReviewableSandboxSubmission(
  submission: ReturnType<typeof readSandboxSubmission>
) {
  return Boolean(submission.endpoint || submission.test_instructions);
}

export function publicConnectorRecord(
  id: string,
  data: Omit<ConnectorDefinitionRecord, "id">
): ConnectorDefinitionRecord {
  return { id, ...data };
}
