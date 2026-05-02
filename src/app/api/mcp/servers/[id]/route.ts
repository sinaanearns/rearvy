import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const docRef = adminDb.collection(COLLECTIONS.MCP_SERVERS).doc(id);
    const doc = await docRef.get();

    if (!doc.exists) {
      return NextResponse.json({ error: "Server not found" }, { status: 404 });
    }

    if (doc.data()?.user_id !== user.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const updates = {
      ...body,
      updated_at: new Date(),
    };
    
    // Ensure we don't overwrite user_id or id
    delete updates.user_id;
    delete updates.id;

    await docRef.update(updates);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("MCP server PATCH error:", error);
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
    console.error("MCP server DELETE error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
