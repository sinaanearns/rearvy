import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { isLegacySystemChat } from "@/lib/chat/system-chats";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("DashboardChatsApi");

type DashboardChatRecord = Record<string, unknown> & {
  id: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  is_group?: boolean;
  user_id?: unknown;
  project_id?: unknown;
  title?: unknown;
  system_chat_type?: unknown;
  updated_at?: unknown;
};

type DashboardChatSummary = {
  id: string;
  user_id?: string;
  is_owner: boolean;
  project_id: string | null;
  title: string;
  updated_at: string | null;
  is_pinned: boolean;
  is_group: boolean;
};

function getTimestamp(value: unknown) {
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

function toIsoTimestamp(value: unknown) {
  if (typeof value === "string") {
    return value;
  }

  const timestamp = getTimestamp(value);
  return timestamp > 0 ? new Date(timestamp).toISOString() : null;
}

function toDashboardChatSummary(chat: DashboardChatRecord, userId: string): DashboardChatSummary {
  const ownerId = typeof chat.user_id === "string" ? chat.user_id : undefined;

  return {
    id: chat.id,
    ...(ownerId ? { user_id: ownerId } : {}),
    is_owner: ownerId === userId,
    project_id: typeof chat.project_id === "string" ? chat.project_id : null,
    title: typeof chat.title === "string" && chat.title.trim() ? chat.title : "Untitled",
    updated_at: toIsoTimestamp(chat.updated_at),
    is_pinned: chat.is_pinned === true,
    is_group: chat.is_group === true,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = data.user.id;

    try {
      const [ownerChatsSnapshot, participantChatsSnapshot] = await Promise.all([
        adminDb
          .collection("chats")
          .where("user_id", "==", userId)
          .get(),
        adminDb
          .collection("chats")
          .where("participant_ids", "array-contains", userId)
          .get()
      ]);

      const chatMap = new Map<string, DashboardChatRecord>();
      
      ownerChatsSnapshot.docs.forEach((doc) => {
        chatMap.set(doc.id, { id: doc.id, ...doc.data() });
      });
      
      participantChatsSnapshot.docs.forEach((doc) => {
        chatMap.set(doc.id, { id: doc.id, ...doc.data() });
      });

      const chats = Array.from(chatMap.values())
        .filter((chat) => (
          chat.is_archived !== true &&
          !isLegacySystemChat(chat)
        ))
        .sort((a, b) => {
          const pinnedDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
          if (pinnedDelta !== 0) {
            return pinnedDelta;
          }

          return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
        })
        .map((chat) => toDashboardChatSummary(chat, userId));

      return NextResponse.json({ chats });
    } catch (dbError) {
      log.error("Error fetching chats from Firestore, returning fallback:", dbError);
      return NextResponse.json({ chats: [], _fallback: true });
    }
  } catch (error) {
    log.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
