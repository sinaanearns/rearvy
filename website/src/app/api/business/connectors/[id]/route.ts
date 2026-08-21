import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import {
  COLLECTIONS,
  type ConnectorDefinitionRecord,
  type ConnectorLifecycleStatus,
} from "@/lib/firebase/schema";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";
import { writeAuditEvent } from "@/lib/audit/writer";
import { requireConnectorPublisher } from "@/lib/rearvy-connectors/publisher-auth";
import {
  connectorLifecycleActionSchema,
  hasReviewableSandboxSubmission,
  nextConnectorLifecycleStatus,
  readSandboxSubmission,
  validateConnectorContract,
} from "@/lib/rearvy-connectors/publisher-registry";

export const runtime = "nodejs";

const log = createServerLogger("BusinessConnectorLifecycleApi");

const LIFECYCLE_STATUSES: ConnectorLifecycleStatus[] = [
  "draft",
  "sandbox",
  "in_review",
  "verified",
  "published",
  "suspended",
];

function readLifecycleStatus(value: unknown): ConnectorLifecycleStatus | null {
  return LIFECYCLE_STATUSES.includes(value as ConnectorLifecycleStatus)
    ? (value as ConnectorLifecycleStatus)
    : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireConnectorPublisher(request);
    if (error) return error;

    const { id } = await params;
    const body = await readJsonRecord(request);
    const actionResult = connectorLifecycleActionSchema.safeParse(body.action);
    if (!actionResult.success) {
      return NextResponse.json({ error: "Unsupported connector lifecycle action." }, { status: 400 });
    }

    const ref = adminDb.collection(COLLECTIONS.CONNECTOR_DEFINITIONS).doc(id);
    const updated = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("CONNECTOR_NOT_FOUND");
      const data = snapshot.data() as Omit<ConnectorDefinitionRecord, "id">;
      if (data.publisher_user_id !== user.uid) throw new Error("CONNECTOR_FORBIDDEN");

      const currentStatus = readLifecycleStatus(data.lifecycle_status);
      if (!currentStatus) throw new Error("CONNECTOR_STATUS_INVALID");
      const nextStatus = nextConnectorLifecycleStatus(currentStatus, actionResult.data);
      const now = new Date().toISOString();
      const updates: Partial<ConnectorDefinitionRecord> = {
        lifecycle_status: nextStatus,
        updated_at: now,
      };

      if (actionResult.data === "validate_contract") {
        const validation = validateConnectorContract(data.manifest);
        updates.contract_validation = {
          passed: validation.passed,
          validated_at: validation.validated_at,
          errors: validation.errors,
        };
        if (!validation.passed) throw new Error(`CONTRACT_INVALID:${validation.errors.join("|")}`);
      } else if (actionResult.data === "submit_review") {
        if (!data.contract_validation?.passed) throw new Error("CONTRACT_NOT_VALIDATED");
        const submission = readSandboxSubmission(body.sandbox_submission);
        if (!hasReviewableSandboxSubmission(submission)) {
          throw new Error("SANDBOX_SUBMISSION_REQUIRED");
        }
        updates.sandbox_submission = { ...submission, submitted_at: now };
        updates.review_submitted_at = now;
      } else {
        updates.sandbox_submission = null;
        updates.review_submitted_at = null;
        updates.review_notes = null;
      }

      transaction.update(ref, updates);
      return { id, ...data, ...updates };
    });

    await writeAuditEvent({
      userId: user.uid,
      category: "connector_publisher",
      action: `connector_${actionResult.data}`,
      resourceId: id,
      metadata: { lifecycleStatus: updated.lifecycle_status },
      severity: actionResult.data === "submit_review" ? "high" : "medium",
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : String(error);
    if (message === "CONNECTOR_NOT_FOUND") {
      return NextResponse.json({ error: "Connector not found." }, { status: 404 });
    }
    if (message === "CONNECTOR_FORBIDDEN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (message.startsWith("CONTRACT_INVALID:")) {
      const details = message.slice("CONTRACT_INVALID:".length).split("|");
      return NextResponse.json(
        { error: "Connector contract validation failed.", details },
        { status: 400 }
      );
    }
    if (message === "CONTRACT_NOT_VALIDATED") {
      return NextResponse.json({ error: "Validate the connector contract first." }, { status: 409 });
    }
    if (message === "SANDBOX_SUBMISSION_REQUIRED") {
      return NextResponse.json(
        { error: "Provide a sandbox endpoint or local test instructions before review." },
        { status: 400 }
      );
    }
    if (/not allowed while the connector/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    log.error("Unable to update connector lifecycle:", error);
    return NextResponse.json({ error: "Unable to update connector lifecycle." }, { status: 500 });
  }
}
