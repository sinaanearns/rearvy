import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { requireAuth } from "@/lib/firebase/middleware";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { BUILT_IN_ABILITY_TEMPLATES } from "@/lib/work/abilities";

export const runtime = "nodejs";

const log = createServerLogger("WorkAbilitiesApi");

function readString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function timestampToString(value: unknown): string | null {
  if (typeof value === "string" && value) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    try {
      const date = value.toDate();
      return date instanceof Date && !Number.isNaN(date.getTime())
        ? date.toISOString()
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function mcpServerSummary(id: string, data: Record<string, unknown>) {
  const type = data.type === "stdio" || data.type === "sse" ? data.type : "sse";
  return {
    id,
    name: readString(data.name, "MCP server"),
    type,
    command: type === "stdio" ? readString(data.command) || null : null,
    args: type === "stdio" ? readStringArray(data.args) : [],
    url: type === "sse" ? readString(data.url) || null : null,
    is_active: data.is_active !== false,
    created_at: timestampToString(data.created_at),
    updated_at: timestampToString(data.updated_at),
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  try {
    const mcpSnapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", auth.user.uid)
      .get();
    const mcpServers = mcpSnapshot.docs.map((doc) =>
      mcpServerSummary(doc.id, doc.data())
    );

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
