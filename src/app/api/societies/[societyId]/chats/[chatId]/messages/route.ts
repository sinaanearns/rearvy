import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { insertDoc, from, updateDocById, getDocById } from "@/lib/firebase/firestore";
import { z } from "zod";
import { Timestamp } from "firebase/firestore";
import { nanoid } from "nanoid";

const SendMessageSchema = z.object({
  content: z.string().min(1).max(4000),
  mentioned_user_ids: z.array(z.string()).optional(),
});

/**
 * GET /api/societies/:societyId/chats/:chatId/messages
 * List messages in a chat (paginated)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string; chatId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId, chatId } = await params;

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get messages
    const messages = await from(COLLECTIONS.SOCIETY_MESSAGES)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .execute();

    const paginated = messages.reverse().slice(offset, offset + limit);

    return NextResponse.json({
      messages: paginated,
      total: messages.length,
      limit,
      offset,
    });
  } catch (error: any) {
    console.error("GET /api/societies/:societyId/chats/:chatId/messages error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/societies/:societyId/chats/:chatId/messages
 * Send message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ societyId: string; chatId: string }> }
) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { societyId, chatId } = await params;

    const body = await request.json();
    const validatedData = SendMessageSchema.parse(body);

    // Verify chat exists and user is participant
    const { data: chat } = await getDocById(COLLECTIONS.SOCIETY_CHATS, chatId);
    if (!chat) {
      return NextResponse.json(
        { error: "Chat not found" },
        { status: 404 }
      );
    }

    if (!chat.participant_ids?.includes(data.user.uid)) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    // Rate limiting check (simple: count messages in last minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const recentMessages = await from(COLLECTIONS.SOCIETY_MESSAGES)
      .eq("chat_id", chatId)
      .eq("sender_id", data.user.uid)
      .execute();

    const messagesInLastMinute = recentMessages.filter((m) => {
      const createdTime = new Date(m.created_at);
      return createdTime > oneMinuteAgo;
    });

    if (messagesInLastMinute.length >= 10) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Max 10 messages per minute." },
        { status: 429 }
      );
    }

    const messageId = `msg_${nanoid(12)}`;
    const now = Timestamp.now();

    const messageData = {
      id: messageId,
      chat_id: chatId,
      society_id: societyId,
      sender_id: data.user.uid,
      content: validatedData.content,
      mentioned_user_ids: validatedData.mentioned_user_ids || [],
      reactions: {}, // emoji -> array of user_ids
      is_edited: false,
      edited_at: null,
      created_at: now,
      updated_at: now,
    };

    const { error: insertError } = await insertDoc(
      COLLECTIONS.SOCIETY_MESSAGES,
      messageData,
      messageId
    );

    if (insertError) {
      throw insertError;
    }

    // Update chat's last_message_at
    await updateDocById(COLLECTIONS.SOCIETY_CHATS, chatId, {
      last_message_at: now,
      updated_at: now,
    });

    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/societies/:societyId/chats/:chatId/messages error:", error);

    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Validation error", issues: error.errors },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
