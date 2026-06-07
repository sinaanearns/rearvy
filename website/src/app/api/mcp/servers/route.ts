import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import {
  mcpTimestampSortValue,
  normalizeMcpServerDocument,
  normalizeNewMcpServer,
} from "@/lib/ai/mcp/server-config";

const log = createServerLogger("McpServersApi");

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", user.uid)
      .get();

    const servers = snapshot.docs
      .map((doc) => normalizeMcpServerDocument(doc.id, doc.data()))
      .sort(
        (left, right) =>
          mcpTimestampSortValue(right.created_at) - mcpTimestampSortValue(left.created_at)
      );

    return NextResponse.json({ servers });
  } catch (error) {
    log.error("MCP servers GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const newServer = normalizeNewMcpServer(user.uid, body);
    if (!newServer) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const docRef = await adminDb.collection(COLLECTIONS.MCP_SERVERS).add(newServer);

    return NextResponse.json(normalizeMcpServerDocument(docRef.id, newServer));
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("MCP servers POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
