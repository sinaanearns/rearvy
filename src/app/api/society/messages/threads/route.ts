import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  ADMIN_DM_CHAT_SCOPE,
  ADMIN_DM_DISPLAY_TITLE,
  getDirectChatUserFacingTitle,
  isAdminDirectChat,
  resolveAdminUserIds,
  USER_DM_CHAT_SCOPE,
} from "@/lib/chat/direct-messages";
import { buildChatMessagePreview, normalizeChatAttachments } from "@/lib/chat/attachments";

type ChatDoc = {
  user_id?: string;
  participant_ids?: string[];
  is_group?: boolean;
  title?: string | null;
  updated_at?: unknown;
  chat_scope?: string | null;
  user_facing_title?: string | null;
  admin_participant_ids?: string[];
};

type ProfileDoc = {
  full_name?: unknown;
  username?: unknown;
  username_lower?: unknown;
  email?: unknown;
  avatar_url?: unknown;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidDocumentId(value: unknown): value is string {
  return isNonEmptyString(value) && !value.includes("/");
}

function toNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getOtherUserId(chat: ChatDoc, currentUserId: string) {
  const participants = Array.isArray(chat.participant_ids) ? chat.participant_ids : [];
  return participants.find((id): id is string => isValidDocumentId(id) && id !== currentUserId) || null;
}

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

async function getLatestMessageForChat(chatId: string) {
  try {
    const messagesSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .get();

    if (messagesSnapshot.empty) {
      return { content: "", createdAt: 0 };
    }

    let latestContent = "";
    let latestAt = 0;

    messagesSnapshot.docs.forEach((doc) => {
      const msg = doc.data() as {
        content?: unknown;
        created_at?: unknown;
        attachments?: unknown;
        metadata?: {
          attachments?: unknown;
        };
      };
      const createdAt = toTimestamp(msg.created_at);
      if (createdAt >= latestAt) {
        latestAt = createdAt;
        latestContent = buildChatMessagePreview({
          content: msg.content,
          attachments: normalizeChatAttachments(msg.attachments || msg.metadata?.attachments),
        });
      }
    });

    return {
      content: latestContent,
      createdAt: latestAt,
    };
  } catch (error) {
    console.error("GET /api/society/messages/threads latest message fallback error:", error);
    return { content: "", createdAt: 0 };
  }
}

async function getProfilesByUserId(userIds: string[]) {
  const profilesByUserId = new Map<string, ProfileDoc>();

  await Promise.all(
    userIds.map(async (userId) => {
      if (!isValidDocumentId(userId)) {
        return;
      }

      try {
        const profileSnapshot = await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).get();
        if (profileSnapshot.exists) {
          profilesByUserId.set(profileSnapshot.id, profileSnapshot.data() as ProfileDoc);
        }
      } catch (error) {
        console.error("GET /api/society/messages/threads profile lookup error:", userId, error);
      }
    })
  );

  return profilesByUserId;
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;

    const [ownerChatsSnapshot, participantChatsSnapshot] = await Promise.all([
      adminDb.collection(COLLECTIONS.CHATS).where("user_id", "==", userId).get(),
      adminDb
        .collection(COLLECTIONS.CHATS)
        .where("participant_ids", "array-contains", userId)
        .get(),
    ]);

    const chatMap = new Map<string, ChatDoc & { id: string }>();

    ownerChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, { id: doc.id, ...(doc.data() as ChatDoc) });
    });

    participantChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, { id: doc.id, ...(doc.data() as ChatDoc) });
    });

    const candidateDmChats = Array.from(chatMap.values()).filter((chat) => {
      const participants = Array.isArray(chat.participant_ids)
        ? chat.participant_ids
        : [];
      return chat.is_group !== true && participants.length >= 2;
    });

    const otherUserIds = Array.from(
      new Set(
        candidateDmChats
          .map((chat) => getOtherUserId(chat, userId))
          .filter((id): id is string => id !== null)
      )
    );

    const [profilesByUserId, adminUserIds] = await Promise.all([
      getProfilesByUserId(otherUserIds),
      resolveAdminUserIds(otherUserIds),
    ]);

    const dmChats = candidateDmChats;

    const threads: Array<{
      chatId: string;
      updatedAt: unknown;
      title: string | null;
      threadType: typeof USER_DM_CHAT_SCOPE | typeof ADMIN_DM_CHAT_SCOPE;
      otherUser: {
        id: string;
        username: string | null;
        full_name: string | null;
        email: string | null;
        avatar_url: string | null;
      } | null;
      lastMessage: string;
      lastMessageAt: number;
    }> = [];

    for (const chat of dmChats) {
      try {
        const otherUserId = getOtherUserId(chat, userId);
        const latestMessage = await getLatestMessageForChat(chat.id);
        const isAdminThread =
          isAdminDirectChat(chat) ||
          (Array.isArray(chat.admin_participant_ids)
            ? chat.admin_participant_ids.some((participantId) => participantId !== userId)
            : false) ||
          (otherUserId ? adminUserIds.has(otherUserId) : false);
        const otherProfile = otherUserId ? profilesByUserId.get(otherUserId) : undefined;

        threads.push({
          chatId: chat.id,
          updatedAt: toTimestamp(chat.updated_at),
          title: isAdminThread
            ? getDirectChatUserFacingTitle(chat) || ADMIN_DM_DISPLAY_TITLE
            : toNullableString(chat.title),
          threadType: isAdminThread ? ADMIN_DM_CHAT_SCOPE : USER_DM_CHAT_SCOPE,
          otherUser:
            !isAdminThread && otherUserId
              ? {
                  id: otherUserId,
                  username: toNullableString(otherProfile?.username),
                  full_name: toNullableString(otherProfile?.full_name),
                  email: toNullableString(otherProfile?.email),
                  avatar_url: toNullableString(otherProfile?.avatar_url),
                }
              : null,
          lastMessage: latestMessage.content,
          lastMessageAt: latestMessage.createdAt,
        });
      } catch (error) {
        console.error("GET /api/society/messages/threads thread assembly error:", chat.id, error);

        const otherUserId = getOtherUserId(chat, userId);
        const otherProfile = otherUserId ? profilesByUserId.get(otherUserId) : undefined;
        const isAdminThread =
          isAdminDirectChat(chat) ||
          (Array.isArray(chat.admin_participant_ids)
            ? chat.admin_participant_ids.some((participantId) => participantId !== userId)
            : false) ||
          (otherUserId ? adminUserIds.has(otherUserId) : false);

        threads.push({
          chatId: chat.id,
          updatedAt: toTimestamp(chat.updated_at),
          title: isAdminThread
            ? getDirectChatUserFacingTitle(chat) || ADMIN_DM_DISPLAY_TITLE
            : toNullableString(chat.title),
          threadType: isAdminThread ? ADMIN_DM_CHAT_SCOPE : USER_DM_CHAT_SCOPE,
          otherUser:
            !isAdminThread && otherUserId
              ? {
                  id: otherUserId,
                  username: toNullableString(otherProfile?.username),
                  full_name: toNullableString(otherProfile?.full_name),
                  email: toNullableString(otherProfile?.email),
                  avatar_url: toNullableString(otherProfile?.avatar_url),
                }
              : null,
          lastMessage: "",
          lastMessageAt: 0,
        });
      }
    }

    threads.sort((a, b) => {
      const bSort = Math.max(toTimestamp(b.updatedAt), b.lastMessageAt);
      const aSort = Math.max(toTimestamp(a.updatedAt), a.lastMessageAt);
      return bSort - aSort;
    });

    return NextResponse.json({ threads });
  } catch (error) {
    console.error("GET /api/society/messages/threads error:", error);
    return NextResponse.json({ threads: [] });
  }
}
