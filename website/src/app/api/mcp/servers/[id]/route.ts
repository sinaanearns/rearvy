import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import {
  normalizeMcpServerDocument,
  sanitizeMcpServerUpdates,
} from "@/lib/ai/mcp/server-config";

const log = createServerLogger("McpServerApi");

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await readJsonRecord(request);

    const docRef = adminDb.collection(COLLECTIONS.MCP_SERVERS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (doc.data()?.user_id !== user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updates = sanitizeMcpServerUpdates(body);
    const candidate = normalizeMcpServerDocument(id, { ...doc.data(), ...updates });
    if (candidate.type === "stdio" && !candidate.command) {
      return NextResponse.json({ error: "A local MCP connection requires a command." }, { status: 400 });
    }
    if (candidate.type !== "stdio" && !candidate.url) {
      return NextResponse.json({ error: "A web MCP connection requires a valid HTTP or HTTPS URL." }, { status: 400 });
    }

    await docRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("MCP server PATCH error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const docRef = adminDb.collection(COLLECTIONS.MCP_SERVERS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (doc.data()?.user_id !== user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    await docRef.delete();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("MCP server DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
