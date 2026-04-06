import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { uploadChatAttachment } from "@/lib/chat/attachment-storage";

type ChatDoc = {
  user_id?: string;
  participant_ids?: string[];
};

function isChatParticipant(chat: ChatDoc | undefined, userId: string) {
  if (!chat) {
    return false;
  }

  return (
    chat.user_id === userId ||
    (Array.isArray(chat.participant_ids) && chat.participant_ids.includes(userId))
  );
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const chatId = typeof formData.get("chatId") === "string" ? String(formData.get("chatId")) : "";
    const fileEntry = formData.get("file");

    if (!chatId.trim()) {
      return NextResponse.json({ error: "Chat ID is required" }, { status: 400 });
    }

    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: "Attachment file is required" }, { status: 400 });
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

    const attachment = await uploadChatAttachment({
      chatId,
      uploaderId: data.user.id,
      fileName: fileEntry.name || "attachment",
      contentType: fileEntry.type || "application/octet-stream",
      size: fileEntry.size,
      buffer: Buffer.from(await fileEntry.arrayBuffer()),
    });

    return NextResponse.json({ attachment }, { status: 201 });
  } catch (error) {
    console.error("POST /api/society/messages/attachments error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to upload attachment",
      },
      { status: 500 }
    );
  }
}
