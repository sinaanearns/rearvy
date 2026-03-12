import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";

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

    const chats = Array.from(chatMap.values()).sort((a: any, b: any) => {
      const dateA = new Date(a.updated_at || 0).getTime();
      const dateB = new Date(b.updated_at || 0).getTime();
      return dateB - dateA;
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
