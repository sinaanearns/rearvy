import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

type DashboardProjectRecord = Record<string, unknown> & {
  id: string;
  is_archived?: boolean;
  created_at?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getTimestamp(value: unknown): number {
  if (value && typeof value === "object") {
    const timestamp = value as {
      toDate?: () => Date;
      seconds?: unknown;
      nanoseconds?: unknown;
      _seconds?: unknown;
      _nanoseconds?: unknown;
    };

    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      const time = date instanceof Date ? date.getTime() : Number.NaN;
      if (Number.isFinite(time)) return time;
    }

    const seconds =
      typeof timestamp.seconds === "number"
        ? timestamp.seconds
        : typeof timestamp._seconds === "number"
          ? timestamp._seconds
          : null;
    const nanoseconds =
      typeof timestamp.nanoseconds === "number"
        ? timestamp.nanoseconds
        : typeof timestamp._nanoseconds === "number"
          ? timestamp._nanoseconds
          : 0;

    if (seconds !== null) {
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" || value instanceof Date) {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }

  return 0;
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const [ownerProjectsSnap, participantProjectsSnap] = await Promise.all([
        adminDb
          .collection("projects")
          .where("user_id", "==", data.user.id)
          .get(),
        adminDb
          .collection("projects")
          .where("participant_ids", "array-contains", data.user.id)
          .get()
      ]);

      const projectsMap = new Map<string, DashboardProjectRecord>();
      ownerProjectsSnap.docs.forEach((doc) =>
        projectsMap.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) })
      );
      participantProjectsSnap.docs.forEach((doc) =>
        projectsMap.set(doc.id, { id: doc.id, ...(doc.data() as Record<string, unknown>) })
      );

      const projects = Array.from(projectsMap.values())
        .filter((project) => project.is_archived !== true)
        .sort((a, b) => getTimestamp(b.created_at) - getTimestamp(a.created_at));

      return NextResponse.json({ projects });
    } catch (dbError) {
      console.error("Error fetching projects from Firestore, returning fallback:", dbError);
      return NextResponse.json({ projects: [], _fallback: true });
    }
  } catch (error) {
    console.error("Error fetching projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch projects" },
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

    const body = (await request.json()) as {
      name?: unknown;
      description?: unknown;
      template_id?: unknown;
    };
    const name = optionalString(body.name);
    const description = optionalString(body.description);
    const templateId = optionalString(body.template_id);

    if (!name) {
      return NextResponse.json(
        { error: "Project name is required" },
        { status: 400 }
      );
    }

    const projectRef = adminDb.collection("projects").doc();
    const projectId = projectRef.id;

    await projectRef.set({
      id: projectId,
      user_id: data.user.id,
      name,
      description: description || null,
      template_id: templateId || null,
      is_archived: false,
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({ id: projectId });
  } catch (error) {
    console.error("Error creating project:", error);
    return NextResponse.json(
      { error: "Failed to create project" },
      { status: 500 }
    );
  }
}
