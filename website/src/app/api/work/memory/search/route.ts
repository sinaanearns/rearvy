import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";

export const runtime = "nodejs";

function normalize(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function memoryRecord(id: string, data: Record<string, unknown>): Record<string, unknown> & { id: string } {
  return { id, ...data };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const query = normalize(searchParams.get("q"));
  const type = searchParams.get("type")?.trim() || "";
  const parsedLimit = Number(searchParams.get("limit") || 25);
  const limit = Number.isFinite(parsedLimit)
    ? Math.min(Math.max(Math.floor(parsedLimit), 1), 100)
    : 25;

  const snapshot = await adminDb
    .collection(COLLECTIONS.MEMORIES)
    .where("user_id", "==", auth.user.uid)
    .get();

  const memories = snapshot.docs
    .map((doc) => memoryRecord(doc.id, doc.data()))
    .filter((memory) => memory.is_active !== false)
    .filter((memory) => (type ? memory.memory_type === type : true))
    .filter((memory) => {
      if (!query) return true;
      const haystack = normalize(
        [
          memory.content,
          memory.memory_type,
          Array.isArray(memory.tags) ? memory.tags.join(" ") : "",
        ].join(" ")
      );
      return haystack.includes(query);
    })
    .sort((left, right) =>
      String(right.updated_at || right.created_at || "").localeCompare(
        String(left.updated_at || left.created_at || "")
      )
    )
    .slice(0, limit);

  return NextResponse.json({ memories });
}
