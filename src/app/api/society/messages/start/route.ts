import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";

type ProfileDoc = {
  full_name?: string | null;
  username?: string | null;
  username_lower?: string | null;
  email?: string | null;
};

function normalizeUsername(input: string) {
  return input.trim().replace(/^@+/, "").toLowerCase();
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as { username?: unknown };
    const usernameInput = typeof body.username === "string" ? body.username : "";
    const usernameLower = normalizeUsername(usernameInput);

    if (!usernameLower) {
      return NextResponse.json({ error: "Username is required" }, { status: 400 });
    }

    const profileSnap = await adminDb.collection(COLLECTIONS.PROFILES).doc(data.user.id).get();
    const selfProfile = profileSnap.data() as ProfileDoc | undefined;

    const targetByUsername = await adminDb
      .collection(COLLECTIONS.PROFILES)
      .where("username_lower", "==", usernameLower)
      .limit(1)
      .get();

    if (targetByUsername.empty) {
      return NextResponse.json(
        { error: "No Rearvy user found with that username" },
        { status: 404 }
      );
    }

    const targetDoc = targetByUsername.docs[0];

    if (targetDoc.id === data.user.id) {
      return NextResponse.json(
        { error: "You cannot start a chat with yourself" },
        { status: 400 }
      );
    }

    const sortedIds = [data.user.id, targetDoc.id].sort();
    const chatId = `dm_${sortedIds[0]}_${sortedIds[1]}`;
    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatSnap = await chatRef.get();

    if (!chatSnap.exists) {
      await chatRef.set({
        user_id: data.user.id,
        participant_ids: sortedIds,
        project_id: null,
        title: `@${usernameLower}`,
        is_group: false,
        is_pinned: false,
        is_archived: false,
        chat_type: "direct",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    const target = targetDoc.data() as ProfileDoc;

    return NextResponse.json({
      chatId,
      target: {
        id: targetDoc.id,
        username: target.username || null,
        full_name: target.full_name || null,
        email: target.email || null,
      },
      self: {
        username: selfProfile?.username || null,
      },
    });
  } catch (error) {
    console.error("POST /api/society/messages/start error:", error);
    return NextResponse.json(
      { error: "Failed to start conversation" },
      { status: 500 }
    );
  }
}
