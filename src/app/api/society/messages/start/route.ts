import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  buildUserDirectChatPayload,
  getDirectChatId,
  resolveAdminUserIds,
  USER_DM_CHAT_SCOPE,
} from "@/lib/chat/direct-messages";

type ProfileDoc = {
  full_name?: string | null;
  username?: string | null;
  username_lower?: string | null;
  email?: string | null;
  avatar_url?: string | null;
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
    const target = targetDoc.data() as ProfileDoc;

    if (targetDoc.id === data.user.id) {
      return NextResponse.json(
        { error: "You cannot start a chat with yourself" },
        { status: 400 }
      );
    }

    const targetIsAdmin = (await resolveAdminUserIds([targetDoc.id])).has(targetDoc.id);
    if (targetIsAdmin) {
      return NextResponse.json(
        { error: "No Rearvy user found with that username" },
        { status: 404 }
      );
    }

    const chatId = getDirectChatId(data.user.id, targetDoc.id);
    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatSnap = await chatRef.get();
    const nowIso = new Date().toISOString();
    const baseChatPayload = buildUserDirectChatPayload({
      ownerUserId: data.user.id,
      participantIds: [data.user.id, targetDoc.id],
      title: `@${usernameLower}`,
      createdAt: nowIso,
    });

    if (!chatSnap.exists) {
      await chatRef.set(baseChatPayload);
    }

    return NextResponse.json({
      chatId,
      threadType: USER_DM_CHAT_SCOPE,
      threadTitle: `@${target.username || usernameLower}`,
      target: {
        id: targetDoc.id,
        username: target.username || null,
        full_name: target.full_name || null,
        email: target.email || null,
        avatar_url: target.avatar_url || null,
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
