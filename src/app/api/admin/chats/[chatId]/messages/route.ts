import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Timestamp } from "firebase-admin/firestore";
import { nanoid } from "nanoid";

import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { isAdminAuthenticated, getAdminSessionEmail } from "@/lib/admin-auth";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  ADMIN_DM_CHAT_SCOPE,
  ADMIN_DM_DISPLAY_TITLE,
} from "@/lib/chat/direct-messages";
import { normalizeChatAttachments } from "@/lib/chat/attachments";

const SendMessageSchema = z.object({
  content: z.string().max(4000).optional(),
  attachments: z.unknown().optional(),
});

type MessageDoc = {
  created_at?: unknown;
  sender_id?: string | null;
  content?: string | null;
  role?: string;
  attachments?: unknown;
  metadata?: {
    attachments?: unknown;
  };
};

type ChatDoc = {
  participant_ids?: string[];
  read_receipts?: Record<string, unknown>;
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
        // Ignore and continue to the other timestamp shapes.
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

async function resolveAdminUid() {
  const adminEmail = await getAdminSessionEmail();
  if (!adminEmail) {
    throw new Error("Admin session missing email");
  }

  const adminUser = await adminAuth.getUserByEmail(adminEmail);
  return adminUser.uid;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chatId } = await params;
    const adminUid = await resolveAdminUid();

    const chatSnap = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();
    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chatData = (chatSnap.data() || {}) as ChatDoc;
    const participantIds = Array.isArray(chatData.participant_ids) ? chatData.participant_ids : [];
    if (!participantIds.includes(adminUid)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .get();

    const messages = messagesSnapshot.docs
      .map((doc) => {
        const messageData = doc.data() as MessageDoc;

        return {
          id: doc.id,
          ...messageData,
          created_at: messageData.created_at || null,
          attachments: normalizeChatAttachments(
            messageData.attachments || messageData.metadata?.attachments
          ),
        };
      })
      .sort((a, b) => toTimestamp(a.created_at) - toTimestamp(b.created_at));

    const otherParticipantId =
      participantIds.find((participantId) => participantId !== adminUid) || null;
    const readReceipts = chatData.read_receipts || {};
    const viewerLastReadAt = toTimestamp(readReceipts[adminUid]);
    const otherParticipantLastReadAt = otherParticipantId
      ? toTimestamp(readReceipts[otherParticipantId])
      : 0;
    const latestIncomingMessageAt = messages.reduce((latestAt, message) => {
      if (message.sender_id === adminUid) {
        return latestAt;
      }

      return Math.max(latestAt, toTimestamp(message.created_at));
    }, 0);

    if (latestIncomingMessageAt > viewerLastReadAt) {
      await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).set(
        {
          read_receipts: {
            ...readReceipts,
            [adminUid]: Timestamp.now(),
          },
        },
        { merge: true }
      );
    }

    return NextResponse.json({
      messages,
      otherParticipantLastReadAt,
    });
  } catch (error) {
    console.error("GET /api/admin/chats/:chatId/messages error:", error);
    return NextResponse.json(
      { error: "Failed to load messages" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ chatId: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { chatId } = await params;
    const adminUid = await resolveAdminUid();
    const body = await request.json();
    const validated = SendMessageSchema.parse(body);
    const content = typeof validated.content === "string" ? validated.content.trim() : "";
    const attachments = normalizeChatAttachments(validated.attachments);

    if (!content && attachments.length === 0) {
      return NextResponse.json(
        { error: "Message content or an attachment is required" },
        { status: 400 }
      );
    }

    const chatSnap = await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).get();
    if (!chatSnap.exists) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }

    const chatData = (chatSnap.data() || {}) as ChatDoc;
    const participantIds = Array.isArray(chatData.participant_ids) ? chatData.participant_ids : [];
    if (!participantIds.includes(adminUid)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    const messageId = `msg_${nanoid(12)}`;
    const now = Timestamp.now();

    const messageData = {
      id: messageId,
      chat_id: chatId,
      sender_id: adminUid,
      content,
      attachments,
      role: "user",
      parts: null,
      tool_invocations: null,
      metadata: {
        chat_scope: ADMIN_DM_CHAT_SCOPE,
        message_type: "rearvy_admin_dm",
        attachments,
      },
      created_at: now,
    };

    await adminDb.collection(COLLECTIONS.MESSAGES).doc(messageId).set(messageData);

    await adminDb.collection(COLLECTIONS.CHATS).doc(chatId).set(
      {
        chat_scope: ADMIN_DM_CHAT_SCOPE,
        user_facing_title: ADMIN_DM_DISPLAY_TITLE,
        admin_participant_ids: [adminUid],
        updated_at: now,
        read_receipts: {
          ...(chatData.read_receipts || {}),
          [adminUid]: now,
        },
      },
      { merge: true }
    );

    return NextResponse.json({ id: messageId }, { status: 201 });
  } catch (error) {
    console.error("POST /api/admin/chats/:chatId/messages error:", error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Validation error", issues: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Failed to send message" },
      { status: 500 }
    );
  }
}
