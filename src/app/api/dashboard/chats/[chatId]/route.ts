import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

interface RouteParams {
  params: Promise<{ chatId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { chatId } = await params;
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const chatDoc = await adminDb.collection("chats").doc(chatId).get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data();
    if (chat?.user_id !== data.user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Fetch messages for this chat
    const messagesSnapshot = await adminDb
      .collection("messages")
      .where("chat_id", "==", chatId)
      .orderBy("created_at", "asc")
      .get();

    const messages = messagesSnapshot.docs.map((doc) => {
      const msgData = doc.data();
      return {
        id: doc.id,
        role: msgData.role,
        content: msgData.content,
        created_at: msgData.created_at,
      };
    });

    return NextResponse.json({
      chat: { id: chatId, ...chat },
      messages,
    });
  } catch (error) {
    console.error("Error fetching chat:", error);
    return NextResponse.json(
      { error: "Failed to fetch chat" },
      { status: 500 }
    );
  }
}
