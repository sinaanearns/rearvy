import { NextRequest, NextResponse } from "next/server";
import { Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  ADMIN_DM_CHAT_SCOPE,
  ADMIN_DM_DISPLAY_TITLE,
  getDirectChatUserFacingTitle,
  isAdminDirectChat,
  USER_DM_CHAT_SCOPE,
} from "@/lib/chat/direct-messages";
import { normalizeChatAttachments } from "@/lib/chat/attachments";

type ChatDoc = {
  user_id?: string;
  participant_ids?: string[];
  chat_scope?: string | null;
  user_facing_title?: string | null;
  admin_participant_ids?: string[];
  read_receipts?: Record<string, unknown>;
};

type MessageDoc = {
  role?: string;
  content?: string;
  sender_id?: string;
  created_at?: unknown;
  attachments?: unknown;
  metadata?: {
    attachments?: unknown;
  };
};

function toTimestamp(value: unknown): number {
  if (value && typeof value === "object") {
    const timestampValue = value as {
      toDate?: () => Date;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      seconds?: unknown;
      nanoseconds?: unknown;
    };

    if (typeof timestampValue.toDate === "function") {
      try {
        const date = timestampValue.toDate();
        const time = date instanceof Date ? date.getTime() : Number.NaN;
        if (Number.isFinite(time)) {
          return time;
        }
      } catch {
        // Fall through to other timestamp shapes.
      }
    }

    const seconds =
      typeof timestampValue._seconds === "number"
        ? timestampValue._seconds
        : typeof timestampValue.seconds === "number"
          ? timestampValue.seconds
          : null;
    const nanoseconds =
      typeof timestampValue._nanoseconds === "number"
        ? timestampValue._nanoseconds
        : typeof timestampValue.nanoseconds === "number"
          ? timestampValue.nanoseconds
          : 0;

    if (seconds !== null) {
      return seconds * 1000 + Math.floor(nanoseconds / 1_000_000);
    }
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" || value instanceof Date) {
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  return 0;
}

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
    const viewerId = data.user.id;

    const { chatId } = await params;
    const chatDoc = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data() as ChatDoc | undefined;
    if (!isChatParticipant(chat, viewerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .get();

    const messages = messagesSnapshot.docs
      .map((doc) => {
        const msg = doc.data() as MessageDoc;
        const attachments = normalizeChatAttachments(msg.attachments || msg.metadata?.attachments);
        return {
          id: doc.id,
          role: msg.role || "user",
          sender_id: msg.sender_id || null,
          content: msg.content || "",
          created_at: msg.created_at || null,
          attachments,
        };
      })
      .sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));

    const participantIds = Array.isArray(chat?.participant_ids) ? chat.participant_ids : [];
    const otherParticipantId =
      participantIds.find((participantId) => participantId !== viewerId) || null;
    const readReceipts = chat?.read_receipts || {};
    const viewerLastReadAt = toTimestamp(readReceipts[viewerId]);
    const otherParticipantLastReadAt = otherParticipantId
      ? toTimestamp(readReceipts[otherParticipantId])
      : 0;
    const latestIncomingMessageAt = messages.reduce((latestAt, message) => {
      if (message.sender_id === viewerId) {
        return latestAt;
      }

      return Math.max(latestAt, toTimestamp(message.created_at));
    }, 0);

    if (latestIncomingMessageAt > viewerLastReadAt) {
      await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).set(
        {
          read_receipts: {
            ...readReceipts,
            [viewerId]: Timestamp.now(),
          },
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      chat: {
        id: chatId,
        participant_ids: participantIds,
        chat_scope: isAdminDirectChat(chat) ? ADMIN_DM_CHAT_SCOPE : USER_DM_CHAT_SCOPE,
        title: getDirectChatUserFacingTitle(chat) || (isAdminDirectChat(chat) ? ADMIN_DM_DISPLAY_TITLE : null),
        otherParticipantLastReadAt,
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
    const viewerId = data.user.id;

    const { chatId } = await params;
    const body = (await request.json()) as { content?: unknown; attachments?: unknown };
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const attachments = normalizeChatAttachments(body.attachments);

    if (!content && attachments.length === 0) {
      return NextResponse.json(
        { error: "Message content or an attachment is required" },
        { status: 400 }
      );
    }

    const chatRef = adminDb.collection(COLLECTIONS.CHATS).doc(chatId);
    const chatDoc = await chatRef.get();

    if (!chatDoc.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chat = chatDoc.data() as ChatDoc | undefined;
    if (!isChatParticipant(chat, viewerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const messageRef = adminDb.collection(COLLECTIONS.MESSAGES).doc();
    const now = Timestamp.now();

    await messageRef.set({
      chat_id: chatId,
      role: "user",
      sender_id: viewerId,
      content,
      attachments,
      parts: null,
      tool_invocations: null,
      metadata: {
        chat_scope: isAdminDirectChat(chat) ? ADMIN_DM_CHAT_SCOPE : USER_DM_CHAT_SCOPE,
        message_type: isAdminDirectChat(chat) ? "rearvy_admin_reply" : "rearvy_user_dm",
        attachments,
      },
      created_at: now,
    });

    await chatRef.set(
      {
        updated_at: now,
        read_receipts: {
          ...(chat?.read_receipts || {}),
          [viewerId]: now,
        },
      },
      { merge: true }
    );

    return NextResponse.json({ success: true, id: messageRef.id }, { status: 201 });
  } catch (error) {
    console.error("POST /api/society/messages/[chatId] error:", error);
    return NextResponse.json({ error: "Failed to send message" }, { status: 500 });
  }
}
