import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import {
  createChannelConnection,
  getChannelCatalog,
  listChannelConnections,
} from "@/lib/work/channels";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    return NextResponse.json({
      catalog: getChannelCatalog(),
      connections: await listChannelConnections(adminDb, auth.user.uid),
      mode: "live-shells",
    });
  } catch (error) {
    console.error("Failed to list work channels:", error);
    return NextResponse.json(
      { error: "Failed to list work channels." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const connection = await createChannelConnection(adminDb, auth.user.uid, body);
    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create work channel.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
