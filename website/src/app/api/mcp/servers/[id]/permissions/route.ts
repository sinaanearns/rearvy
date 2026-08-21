import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("ApiMcpPermissions");

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_PERMISSIONS)
      .where("user_id", "==", user.uid)
      .where("mcp_server_id", "==", id)
      .get();

    const permissions = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ permissions });
  } catch (error) {
    log.error("MCP permissions GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await readJsonRecord(request);
    const scope = typeof body.scope === "string" ? body.scope : null;
    const granted = typeof body.granted === "boolean" ? body.granted : true;
    const requiresApproval = typeof body.requires_approval === "boolean" ? body.requires_approval : true;

    if (!scope) {
      return NextResponse.json({ error: "Scope is required" }, { status: 400 });
    }

    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_PERMISSIONS)
      .where("user_id", "==", user.uid)
      .where("mcp_server_id", "==", id)
      .where("scope", "==", scope)
      .get();

    const now = new Date().toISOString();

    if (!snapshot.empty) {
      const docId = snapshot.docs[0].id;
      await adminDb.collection(COLLECTIONS.MCP_PERMISSIONS).doc(docId).update({
        granted,
        requires_approval: requiresApproval,
        updated_at: now,
      });
    } else {
      await adminDb.collection(COLLECTIONS.MCP_PERMISSIONS).add({
        user_id: user.uid,
        mcp_server_id: id,
        scope,
        granted,
        requires_approval: requiresApproval,
        created_at: now,
        updated_at: now,
      });
    }

    return NextResponse.json({ success: true, scope, granted });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    log.error("MCP permissions PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
