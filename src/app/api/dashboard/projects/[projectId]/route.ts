import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { projectId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const projectDoc = await adminDb
      .collection("projects")
      .doc(projectId)
      .get();

    if (!projectDoc.exists) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    const project = projectDoc.data();
    if (project?.user_id !== data.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch chats for this project
    const chatsSnapshot = await adminDb
      .collection("chats")
      .where("project_id", "==", projectId)
      .where("user_id", "==", data.user.id)
      .orderBy("updated_at", "desc")
      .get();

    const chats = chatsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      project: { id: projectId, ...project },
      chats,
    });
  } catch (error) {
    console.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
