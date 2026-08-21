import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("DashboardProjectApi");

type ProjectRecord = Record<string, unknown> & {
  user_id?: unknown;
  participant_ids?: unknown;
};

type ProjectChatRecord = Record<string, unknown> & {
  id: string;
  updated_at?: unknown;
};

function getTimestamp(value: unknown): number {
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: () => Date };
    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      const time = date instanceof Date ? date.getTime() : Number.NaN;
      if (Number.isFinite(time)) return time;
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" || value instanceof Date) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

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

    const project = projectDoc.data() as ProjectRecord | undefined;
    const isOwner = project?.user_id === data.user.id;
    const isParticipant = Array.isArray(project?.participant_ids) && project.participant_ids.includes(data.user.id);

    if (!isOwner && !isParticipant) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch chats for this project
    const chatsSnapshot = await adminDb
      .collection("chats")
      .where("project_id", "==", projectId)
      .get();

    const chats = chatsSnapshot.docs
      .map<ProjectChatRecord>((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      }))
      .sort((a, b) => getTimestamp(b.updated_at) - getTimestamp(a.updated_at));

    return NextResponse.json({
      project: { id: projectId, ...project },
      chats,
    });
  } catch (error) {
    log.error("Error fetching project:", error);
    return NextResponse.json(
      { error: "Failed to fetch project" },
      { status: 500 }
    );
  }
}
