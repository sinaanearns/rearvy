import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import { redactSensitiveMemoryText } from "@/lib/sensitive-memory";

const log = createServerLogger("DashboardMemoryApi");

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
    log.error("Error deleting memory:", error);
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

    const body = await readJsonRecord(request);
    const content =
      typeof body.content === "string"
        ? redactSensitiveMemoryText(body.content).trim()
        : "";

    if (!content) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    await adminDb.collection("memories").doc(memoryId).update({
      content,
      updated_at: new Date(),
    });

    return NextResponse.json({ success: true, content });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error updating memory:", error);
    return NextResponse.json(
      { error: "Failed to update memory" },
      { status: 500 }
    );
  }
}
