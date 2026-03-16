import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

function getTimestamp(value: unknown) {
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

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    const chatMap = new Map();
    
    ownerChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, { id: doc.id, ...doc.data() });
    });
    
    participantChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, { id: doc.id, ...doc.data() });
    });

    const chats = Array.from(chatMap.values())
      .filter((chat: any) => chat.is_archived !== true)
      .sort((a: any, b: any) => {
        const pinnedDelta = Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned));
        if (pinnedDelta !== 0) {
          return pinnedDelta;
        }

        return getTimestamp(b.updated_at) - getTimestamp(a.updated_at);
      });

    return NextResponse.json({ chats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    return NextResponse.json(
      { error: "Failed to fetch chats" },
      { status: 500 }
    );
  }
}
