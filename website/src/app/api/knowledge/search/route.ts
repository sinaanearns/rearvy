import { requireAuth } from "@/lib/firebase/middleware";
import { retrieveKnowledge } from "@/lib/knowledge/retriever";
import { createServerLogger } from "@/lib/server-logger";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const log = createServerLogger("Api:KnowledgeSearch");

/** POST /api/knowledge/search - Query knowledge chunks via vector search */
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) {
    return auth.error;
  }
  const userId = auth.user!.uid;

  try {
    const body = await req.json();
    const { query, projectId = null, limit = 5 } = body;

    if (!query) {
      return NextResponse.json({ error: "Missing query" }, { status: 400 });
    }

    const matches = await retrieveKnowledge({
      userId,
      query,
      projectId,
      limit,
    });

    return NextResponse.json(matches);
  } catch (error) {
    log.error("Failed to query knowledge base", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
