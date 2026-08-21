import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { listFileMemory, updateFileMemory } from "@/lib/filesystem-memory";
import { readJsonRecord } from "@/lib/api/request-body";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";
  const items = await listFileMemory(auth.user.uid, query);
  return NextResponse.json({ items });
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = await readJsonRecord(request);
    if (typeof body.path !== "string" || typeof body.content !== "string") {
      return NextResponse.json({ error: "A file path and content are required." }, { status: 400 });
    }

    const item = await updateFileMemory(auth.user.uid, body.path, body.content);
    return NextResponse.json({ item });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Workspace file could not be updated.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
