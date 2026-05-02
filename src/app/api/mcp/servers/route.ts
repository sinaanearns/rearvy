import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function GET(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const snapshot = await adminDb
      .collection(COLLECTIONS.MCP_SERVERS)
      .where("user_id", "==", user.uid)
      .orderBy("created_at", "desc")
      .get();

    const servers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      created_at: doc.data().created_at?.toDate?.() || doc.data().created_at,
      updated_at: doc.data().updated_at?.toDate?.() || doc.data().updated_at,
    }));

    return NextResponse.json({ servers });
  } catch (error) {
    console.error("MCP servers GET error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = await requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { name, type, command, args, env, url } = body;

    if (!name || !type) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const newServer = {
      user_id: user.uid,
      name,
      type,
      command: command || null,
      args: args || [],
      env: env || {},
      url: url || null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    };

    const docRef = await adminDb.collection(COLLECTIONS.MCP_SERVERS).add(newServer);

    return NextResponse.json({ id: docRef.id, ...newServer });
  } catch (error) {
    console.error("MCP servers POST error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
