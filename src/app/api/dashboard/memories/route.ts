import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get optional project_id filter from query params
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("project_id");

    // Query just by user_id to avoid needing a composite index
    const memoriesSnapshot = await adminDb
      .collection("memories")
      .where("user_id", "==", data.user.id)
      .get();

    // Filter, sort, and transform timestamps in memory
    const memories = memoriesSnapshot.docs
      .map((doc) => {
        const docData = doc.data();
        let created_at = docData.created_at;

        // Convert Firestore Timestamp to ISO string for the frontend
        if (created_at && typeof created_at.toDate === 'function') {
          created_at = created_at.toDate().toISOString();
        } else if (created_at instanceof Date) {
          created_at = created_at.toISOString();
        }

        return {
          id: doc.id,
          ...docData,
          created_at,
        };
      })
      .filter((m: any) => m.is_active === true)
      .filter((m: any) => {
        // If project_id is specified, only return memories for that project
        // If no project_id, return global memories (no project_id field)
        if (projectId) return m.project_id === projectId;
        return !m.project_id;
      })
      .sort((a: any, b: any) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

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
      project_id,
    } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "Memory content is required" },
        { status: 400 }
      );
    }

    const memoryRef = adminDb.collection("memories").doc();
    const memoryId = memoryRef.id;

    const memoryData: Record<string, any> = {
      id: memoryId,
      user_id: data.user.id,
      content: content.trim(),
      memory_type,
      importance,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (project_id) {
      memoryData.project_id = project_id;
    }

    await memoryRef.set(memoryData);

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
