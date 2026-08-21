import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireRearvyAdmin } from "@/lib/firebase/admin-authorization";
import {
  COLLECTIONS,
  type ConnectorDefinitionRecord,
  type ConnectorLifecycleStatus,
} from "@/lib/firebase/schema";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";
import { writeAuditEvent } from "@/lib/audit/writer";
import {
  connectorReviewActionSchema,
  nextConnectorReviewStatus,
} from "@/lib/rearvy-connectors/publisher-registry";

export const runtime = "nodejs";

const log = createServerLogger("AdminConnectorReviewApi");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireRearvyAdmin(request);
    if (error) return error;

    const { id } = await params;
    const body = await readJsonRecord(request);
    const actionResult = connectorReviewActionSchema.safeParse(body.action);
    if (!actionResult.success) {
      return NextResponse.json({ error: "Unsupported connector review action." }, { status: 400 });
    }
    const reviewNotes = typeof body.review_notes === "string" ? body.review_notes.trim().slice(0, 4_000) : "";
    if ((actionResult.data === "reject" || actionResult.data === "suspend") && reviewNotes.length < 5) {
      return NextResponse.json(
        { error: "Review notes are required when rejecting or suspending a connector." },
        { status: 400 }
      );
    }

    const ref = adminDb.collection(COLLECTIONS.CONNECTOR_DEFINITIONS).doc(id);
    const updated = await adminDb.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new Error("CONNECTOR_NOT_FOUND");
      const data = snapshot.data() as Omit<ConnectorDefinitionRecord, "id">;
      const nextStatus = nextConnectorReviewStatus(
        data.lifecycle_status as ConnectorLifecycleStatus,
        actionResult.data
      );
      if (actionResult.data === "verify") {
        if (!data.contract_validation?.passed || !data.sandbox_submission) {
          throw new Error("CONNECTOR_REVIEW_INCOMPLETE");
        }
      }

      const now = new Date().toISOString();
      const updates: Partial<ConnectorDefinitionRecord> = {
        lifecycle_status: nextStatus,
        reviewed_at: now,
        reviewed_by: user.uid,
        review_notes: reviewNotes || null,
        updated_at: now,
      };
      if (actionResult.data === "reject") {
        updates.sandbox_submission = null;
        updates.review_submitted_at = null;
      }

      transaction.update(ref, updates);
      return { id, ...data, ...updates };
    });

    await writeAuditEvent({
      userId: user.uid,
      category: "connector_review",
      action: `connector_${actionResult.data}`,
      resourceId: id,
      metadata: {
        publisherUserId: updated.publisher_user_id,
        connectorId: updated.connector_id,
        version: updated.connector_version,
        lifecycleStatus: updated.lifecycle_status,
      },
      severity: actionResult.data === "suspend" ? "critical" : "high",
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
    if (message === "CONNECTOR_REVIEW_INCOMPLETE") {
      return NextResponse.json(
        { error: "Contract validation and sandbox submission are required before verification." },
        { status: 409 }
      );
    }
    if (/review action .* is not allowed/i.test(message)) {
      return NextResponse.json({ error: message }, { status: 409 });
    }

    log.error("Unable to review connector:", error);
    return NextResponse.json({ error: "Unable to review connector." }, { status: 500 });
  }
}
