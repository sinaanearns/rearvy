import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const memoriesSnapshot = await adminDb
      .collection("memories")
      .where("user_id", "==", data.user.id)
      .where("is_active", "==", true)
      .orderBy("created_at", "desc")
      .get();

    const memories = memoriesSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({ memories });
  } catch (error) {
    console.error("Error fetching memories:", error);
    return NextResponse.json(
      { error: "Failed to fetch memories" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      content,
      memory_type = "fact",
      importance = 5,
    } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Memory content is required" },
        { status: 400 }
      );
    }

    const memoryRef = adminDb.collection("memories").doc();
    const memoryId = memoryRef.id;

    await memoryRef.set({
      id: memoryId,
      user_id: data.user.id,
      content: content.trim(),
      memory_type,
      importance,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      id: memoryId,
      content: content.trim(),
      memory_type,
      importance,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error creating memory:", error);
    return NextResponse.json(
      { error: "Failed to create memory" },
      { status: 500 }
    );
  }
}
