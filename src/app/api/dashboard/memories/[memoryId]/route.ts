import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

interface RouteParams {
  params: Promise<{ memoryId: string }>;
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { memoryId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memoryDoc = await adminDb
      .collection("memories")
      .doc(memoryId)
      .get();

    if (!memoryDoc.exists) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    const memory = memoryDoc.data();
    if (memory?.user_id !== data.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Soft delete
    await adminDb.collection("memories").doc(memoryId).update({
      is_active: false,
      updated_at: new Date(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting memory:", error);
    return NextResponse.json(
      { error: "Failed to delete memory" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { memoryId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memoryDoc = await adminDb
      .collection("memories")
      .doc(memoryId)
      .get();

    if (!memoryDoc.exists) {
      return NextResponse.json(
        { error: "Memory not found" },
        { status: 404 }
      );
    }

    const memory = memoryDoc.data();
    if (memory?.user_id !== data.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    await adminDb.collection("memories").doc(memoryId).update({
      content: content.trim(),
      updated_at: new Date(),
    });

    return NextResponse.json({ success: true, content: content.trim() });
  } catch (error) {
    console.error("Error updating memory:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
