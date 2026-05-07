import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { isLegacySystemChat } from "@/lib/chat/system-chats";

type DashboardChatRecord = Record<string, unknown> & {
  id: string;
  is_archived?: boolean;
  is_pinned?: boolean;
  title?: unknown;
  system_chat_type?: unknown;
  updated_at?: unknown;
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

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      const [ownerChatsSnapshot, participantChatsSnapshot] = await Promise.all([
        adminDb
          .collection("chats")
          .where("user_id", "==", data.user.id)
          .get(),
        adminDb
          .collection("chats")
          .where("participant_ids", "array-contains", data.user.id)
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
        });

      return NextResponse.json({ chats });
    } catch (dbError) {
      console.error("Error fetching chats from Firestore, returning fallback:", dbError);
      return NextResponse.json({ chats: [], _fallback: true });
    }
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
