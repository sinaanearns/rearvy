import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";

type ChatDoc = {
  user_id?: string;
  participant_ids?: string[];
  is_group?: boolean;
  title?: string | null;
  updated_at?: unknown;
};

type ProfileDoc = {
  full_name?: string | null;
  username?: string | null;
  username_lower?: string | null;
  email?: string | null;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toTimestamp(value: unknown): number {
  if (value && typeof value === "object" && "toDate" in value) {
    const toDate = (value as { toDate?: () => Date }).toDate;
    if (typeof toDate === "function") {
      return toDate().getTime();
    }
  }

  if (typeof value === "string" || value instanceof Date) {
    return new Date(value).getTime();
  }

  return 0;
}

async function getLatestMessageForChat(chatId: string) {
  try {
    const orderedSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .orderBy("created_at", "asc")
      .limitToLast(1)
      .get();

    if (orderedSnapshot.empty) {
      return { content: "", createdAt: 0 };
    }

    const msg = orderedSnapshot.docs[0].data() as { content?: unknown; created_at?: unknown };
    return {
      content: typeof msg.content === "string" ? msg.content : "",
      createdAt: toTimestamp(msg.created_at),
    };
  } catch {
    // Fallback for environments without the composite index used by orderBy + where.
    const fallbackSnapshot = await adminDb
      .collection(COLLECTIONS.MESSAGES)
      .where("chat_id", "==", chatId)
      .get();

    if (fallbackSnapshot.empty) {
      return { content: "", createdAt: 0 };
    }

    let latestContent = "";
    let latestAt = 0;

    fallbackSnapshot.docs.forEach((doc) => {
      const msg = doc.data() as { content?: unknown; created_at?: unknown };
      const createdAt = toTimestamp(msg.created_at);
      if (createdAt >= latestAt) {
        latestAt = createdAt;
        latestContent = typeof msg.content === "string" ? msg.content : "";
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

    const dmChats = Array.from(chatMap.values()).filter((chat) => {
      const participants = Array.isArray(chat.participant_ids)
        ? chat.participant_ids
        : [];
      return chat.is_group !== true && participants.length >= 2;
    });

    const otherUserIds = Array.from(
      new Set(
        dmChats
          .flatMap((chat) => (Array.isArray(chat.participant_ids) ? chat.participant_ids : []))
          .filter((id): id is string => isNonEmptyString(id) && id !== userId)
      )
    );

    const profileSnapshots = await Promise.allSettled(
      otherUserIds.map((id) => adminDb.collection(COLLECTIONS.PROFILES).doc(id).get())
    );

    const profilesByUserId = new Map<string, ProfileDoc>();
    profileSnapshots.forEach((snap) => {
      if (snap.status === "fulfilled" && snap.value.exists) {
        profilesByUserId.set(snap.value.id, snap.value.data() as ProfileDoc);
      }
    });

    const threads: Array<{
      chatId: string;
      updatedAt: unknown;
      title: string | null;
      otherUser: {
        id: string;
        username: string | null;
        full_name: string | null;
        email: string | null;
      } | null;
      lastMessage: string;
      lastMessageAt: number;
    }> = [];

    for (const chat of dmChats) {
      try {
        const participants = Array.isArray(chat.participant_ids) ? chat.participant_ids : [];
        const otherUserId = participants.find((id): id is string => isNonEmptyString(id) && id !== userId) || null;
        const latestMessage = await getLatestMessageForChat(chat.id);

        const otherProfile = otherUserId ? profilesByUserId.get(otherUserId) : undefined;

        threads.push({
          chatId: chat.id,
          updatedAt: chat.updated_at || null,
          title: chat.title || null,
          otherUser: otherUserId
            ? {
                id: otherUserId,
                username: otherProfile?.username || null,
                full_name: otherProfile?.full_name || null,
                email: otherProfile?.email || null,
              }
            : null,
          lastMessage: latestMessage.content,
          lastMessageAt: latestMessage.createdAt,
        });
      } catch (error) {
        console.error("GET /api/society/messages/threads thread assembly error:", chat.id, error);

        const participants = Array.isArray(chat.participant_ids) ? chat.participant_ids : [];
        const otherUserId = participants.find((id): id is string => isNonEmptyString(id) && id !== userId) || null;
        const otherProfile = otherUserId ? profilesByUserId.get(otherUserId) : undefined;

        threads.push({
          chatId: chat.id,
          updatedAt: chat.updated_at || null,
          title: chat.title || null,
          otherUser: otherUserId
            ? {
                id: otherUserId,
                username: otherProfile?.username || null,
                full_name: otherProfile?.full_name || null,
                email: otherProfile?.email || null,
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
    return NextResponse.json({ error: "Failed to load threads" }, { status: 500 });
  }
}
