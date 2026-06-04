import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";

const log = createServerLogger("McpServersApi");

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readStringArray(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function readStringRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([key, entryValue]) => [key.trim(), entryValue.trim()])
      .filter(([key]) => key.length > 0)
  );
}

function normalizeTimestamp(value: unknown): string | null {
  if (value && typeof value === "object") {
    const timestamp = value as { toDate?: unknown };
    if (typeof timestamp.toDate === "function") {
      const date = timestamp.toDate();
      if (date instanceof Date && Number.isFinite(date.getTime())) {
        return date.toISOString();
      }
    }
  }

  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === "string" || typeof value === "number") {
    const date = new Date(value);
    if (Number.isFinite(date.getTime())) {
      return date.toISOString();
    }
  }

  return null;
}

function timestampSortValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", user.uid)
      .get();

    const servers = snapshot.docs
      .map((doc) => {
        const server = doc.data();

        return {
          id: doc.id,
          ...server,
          created_at: normalizeTimestamp(server.created_at),
          updated_at: normalizeTimestamp(server.updated_at),
        };
      })
      .sort(
        (left, right) =>
          timestampSortValue(right.created_at) - timestampSortValue(left.created_at)
      );

    return NextResponse.json({ servers });
  } catch (error) {
    log.error("MCP servers GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await readJsonRecord(request);
    const name = readString(body.name);
    const type = readString(body.type);
    const command = readString(body.command);
    const url = readString(body.url);

    if (!name || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newServer = {
      user_id: user.uid,
      name,
      type,
      command: command || null,
      args: readStringArray(body.args),
      env: readStringRecord(body.env),
      url: url || null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const docRef = await adminDb.collection(COLLECTIONS.MCP_SERVERS).add(newServer);

    return NextResponse.json({ id: docRef.id, ...newServer });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("MCP servers POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
