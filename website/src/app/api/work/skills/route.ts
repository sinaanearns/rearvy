import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { BUILT_IN_ABILITY_TEMPLATES } from "@/lib/work/abilities";

export const runtime = "nodejs";

const log = createServerLogger("WorkAbilitiesApi");

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const mcpSnapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", auth.user.uid)
      .get();
    const mcpServers = mcpSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return NextResponse.json({
      abilities: BUILT_IN_ABILITY_TEMPLATES,
      catalog: BUILT_IN_ABILITY_TEMPLATES,
      installed: [],
      mcpServers,
    });
  } catch (error) {
    log.error("Failed to list work abilities:", error);
    return NextResponse.json(
      { error: "Failed to list work abilities." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    return NextResponse.json({
      ok: true,
      message:
        "Rearvy abilities are built in now. There is no installation step.",
    });
  } catch (error) {
    log.error("Failed to handle legacy work ability install request:", error);
    return NextResponse.json(
      { error: "Rearvy abilities are built in now." },
      { status: 500 }
    );
  }
}
