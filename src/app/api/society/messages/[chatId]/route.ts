import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";

type ChatDoc = {
  user_id?: string;
  participant_ids?: string[];
};

type MessageDoc = {
  role?: string;
  content?: string;
  sender_id?: string;
  created_at?: unknown;
};

function isChatParticipant(chat: ChatDoc | undefined, userId: string) {
  if (!chat) return false;
  const isOwner = chat.user_id === userId;
  const isParticipant =
    Array.isArray(chat.participant_ids) && chat.participant_ids.includes(userId);
  return isOwner || isParticipant;
}

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const chatDoc = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data() as ChatDoc | undefined;
    if (!isChatParticipant(chat, data.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .orderBy("created_at", "asc")
      .limit(300)
      .get();

    const messages = messagesSnapshot.docs.map((doc) => {
      const msg = doc.data() as MessageDoc;
      return {
        id: doc.id,
        role: msg.role || "user",
        sender_id: msg.sender_id || null,
        content: msg.content || "",
        created_at: msg.created_at || null,
      };
    });

    return NextResponse.json({
      chat: {
        id: chatId,
        participant_ids: Array.isArray(chat?.participant_ids) ? chat?.participant_ids : [],
      },
      messages,
    });
  } catch (error) {
    console.error("GET /api/society/messages/[chatId] error:", error);
    return NextResponse.json({ error: "Failed to load chat" }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { chatId } = await params;
    const body = (await request.json()) as { content?: unknown };
    const content = typeof body.content === "string" ? body.content.trim() : "";

    if (!content) {
      return NextResponse.json({ error: "Message content is required" }, { status: 400 });
    }

    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data() as ChatDoc | undefined;
    if (!isChatParticipant(chat, data.user.id)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageRef = adminDb.collection(COLLECTIONS.MESSAGES).doc();
    const nowIso = new Date().toISOString();

    await messageRef.set({
      chat_id: chatId,
      role: "user",
      sender_id: data.user.id,
      content,
      parts: null,
      tool_invocations: null,
      metadata: {
        message_type: "rearvy_user_dm",
      },
      created_at: nowIso,
    });

    await chatRef.set(
      {
        updated_at: nowIso,
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: messageRef.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/society/messages/[chatId] error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
