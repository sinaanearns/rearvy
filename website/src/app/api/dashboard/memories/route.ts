import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { createServerLogger } from "@/lib/server-logger";
import { redactSensitiveMemoryText } from "@/lib/sensitive-memory";

const log = createServerLogger("DashboardMemoriesApi");

type MemoryRecord = Record<string, unknown> & {
  id: string;
  is_active?: unknown;
  project_id?: unknown;
  created_at?: unknown;
};

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

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

function normalizeCreatedAt(value: unknown): string | unknown {
  const timestamp = getTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toISOString() : value;
}

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
      .map<MemoryRecord>((doc) => {
        const docData = doc.data() as Record<string, unknown>;
        return {
          id: doc.id,
          ...docData,
          created_at: normalizeCreatedAt(docData.created_at),
        };
      })
      .filter((memory) => memory.is_active === true)
      .filter((memory) => {
        // If project_id is specified, only return memories for that project
        // If no project_id, return global memories (no project_id field)
        if (projectId) return memory.project_id === projectId;
        return !memory.project_id;
      })
      .sort((a, b) => getTimestamp(b.created_at) - getTimestamp(a.created_at));

    return NextResponse.json({ memories });
  } catch (error) {
    log.error("Error fetching memories:", error);
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

    const body = await readJsonRecord(request);
    const content = optionalString(
      typeof body.content === "string"
        ? redactSensitiveMemoryText(body.content)
        : body.content
    );
    const memoryType = optionalString(body.memory_type) || "fact";
    const importance =
      typeof body.importance === "number" && Number.isFinite(body.importance)
        ? body.importance
        : 5;
    const projectId = optionalString(body.project_id);

    if (!content) {
      return NextResponse.json(
        { error: "Memory content is required" },
        { status: 400 }
      );
    }

    const memoryRef = adminDb.collection("memories").doc();
    const memoryId = memoryRef.id;

    const memoryData: Record<string, unknown> = {
      id: memoryId,
      user_id: data.user.id,
      content,
      memory_type: memoryType,
      importance,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    if (projectId) {
      memoryData.project_id = projectId;
    }

    await memoryRef.set(memoryData);

    return NextResponse.json({
      id: memoryId,
      content,
      memory_type: memoryType,
      importance,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Error creating memory:", error);
    return NextResponse.json(
      { error: "Failed to create memory" },
      { status: 500 }
    );
  }
}
