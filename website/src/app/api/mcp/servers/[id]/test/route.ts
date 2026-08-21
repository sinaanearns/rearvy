import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { normalizeMcpServerDocument } from "@/lib/ai/mcp/server-config";
import { testMcpServerConnection } from "@/lib/ai/mcp/hub";

const log = createServerLogger("ApiMcpTest");

export async function POST(
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

    const serverData = doc.data()!;
    if (serverData.user_id !== user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const normalized = normalizeMcpServerDocument(id, serverData);
    const testResult = await testMcpServerConnection(normalized);

    // Update health status & capabilities in Firestore
    const updates = {
      health_status: testResult.success ? "healthy" : "unreachable",
      latency_ms: testResult.latency_ms,
      capabilities: testResult.capabilities,
      tool_catalog: testResult.tools,
      last_tested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    await docRef.update(updates);

    return NextResponse.json({
      id,
      ...testResult,
    });
  } catch (error) {
    log.error("MCP test connection error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
