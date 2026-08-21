import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { createServerLogger } from "@/lib/server-logger";
import { writeAuditEvent } from "@/lib/audit/writer";
import { requireConnectorPublisher } from "@/lib/rearvy-connectors/publisher-auth";
import {
  connectorVisibilitySchema,
  createConnectorDefinitionId,
  publicConnectorRecord,
  validateConnectorContract,
} from "@/lib/rearvy-connectors/publisher-registry";

export const runtime = "nodejs";

const log = createServerLogger("BusinessConnectorsApi");

function timestampSortValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || value instanceof Date) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const authorization = await requireConnectorPublisher(request);
    if (authorization.error) return authorization.error;
    const { user, publisher } = authorization;

    const snapshot = await adminDb
      .collection(COLLECTIONS.CONNECTOR_DEFINITIONS)
      .where("publisher_user_id", "==", user.uid)
      .limit(100)
      .get();
    const connectors = snapshot.docs
      .map((doc): Record<string, unknown> & { id: string } => ({
        id: doc.id,
        ...doc.data(),
      }))
      .sort(
        (left, right) =>
          timestampSortValue(right.updated_at) - timestampSortValue(left.updated_at)
      );

    return NextResponse.json({
      connectors,
      publisher: {
        registered: true,
        accessSource: publisher.accessSource,
      },
    });
  } catch (error) {
    log.error("Unable to list publisher connectors:", error);
    return NextResponse.json({ error: "Unable to load connectors." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireConnectorPublisher(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const validation = validateConnectorContract(body.manifest);
    if (!validation.passed || !validation.manifest) {
      return NextResponse.json(
        { error: "Connector manifest is invalid.", details: validation.errors },
        { status: 400 }
      );
    }
    const visibility = connectorVisibilitySchema.safeParse(body.visibility);
    if (!visibility.success) {
      return NextResponse.json(
        { error: "Visibility must be either 'private' or 'catalog'." },
        { status: 400 }
      );
    }

    const manifest = validation.manifest;
    const id = createConnectorDefinitionId(user.uid, manifest.id, manifest.version);
    const ref = adminDb.collection(COLLECTIONS.CONNECTOR_DEFINITIONS).doc(id);
    const now = new Date().toISOString();
    const record = {
      publisher_user_id: user.uid,
      connector_id: manifest.id,
      connector_version: manifest.version,
      manifest,
      visibility: visibility.data,
      lifecycle_status: "draft" as const,
      contract_validation: {
        passed: true,
        validated_at: validation.validated_at,
        errors: [],
      },
      sandbox_submission: null,
      review_submitted_at: null,
      reviewed_at: null,
      reviewed_by: null,
      review_notes: null,
      created_at: now,
      updated_at: now,
    };

    const created = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(ref);
      if (existing.exists) return false;
      transaction.create(ref, record);
      return true;
    });
    if (!created) {
      return NextResponse.json(
        { error: "This connector version already exists. Create a new semantic version." },
        { status: 409 }
      );
    }

    await writeAuditEvent({
      userId: user.uid,
      category: "connector_publisher",
      action: "connector_draft_created",
      resourceId: id,
      metadata: {
        connectorId: manifest.id,
        version: manifest.version,
        visibility: visibility.data,
      },
      severity: "medium",
    });

    return NextResponse.json(publicConnectorRecord(id, record), { status: 201 });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("Unable to create connector draft:", error);
    return NextResponse.json({ error: "Unable to create connector draft." }, { status: 500 });
  }
}
