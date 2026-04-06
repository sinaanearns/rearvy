import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { resolveAdminUserIds } from "@/lib/chat/direct-messages";

type ChatDoc = {
  participant_ids?: string[];
  is_group?: boolean;
};

type ProfileDoc = {
  full_name?: string | null;
  username?: string | null;
  email?: string | null;
  avatar_url?: string | null;
};

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

    const chatMap = new Map<string, ChatDoc>();
    ownerChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, doc.data() as ChatDoc);
    });
    participantChatsSnapshot.docs.forEach((doc) => {
      chatMap.set(doc.id, doc.data() as ChatDoc);
    });

    const existingDmUserIds = new Set<string>();
    chatMap.forEach((chat) => {
      if (chat.is_group === true) return;
      const participants = Array.isArray(chat.participant_ids) ? chat.participant_ids : [];
      if (participants.length < 2) return;

      participants.forEach((participantId) => {
        if (participantId !== userId) {
          existingDmUserIds.add(participantId);
        }
      });
    });

    const profileSnapshot = await adminDb.collection(COLLECTIONS.PROFILES).limit(120).get();

    const adminUserIds = await resolveAdminUserIds(profileSnapshot.docs.map((doc) => doc.id));

    const suggestions = profileSnapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as ProfileDoc) }))
      .filter((profile) => profile.id !== userId)
      .filter((profile) => !adminUserIds.has(profile.id))
      .filter((profile) => typeof profile.username === "string" && profile.username.trim().length > 0)
      .filter((profile) => !existingDmUserIds.has(profile.id))
      .sort((a, b) => {
        const aName = (a.full_name || a.username || a.email || "").toLowerCase();
        const bName = (b.full_name || b.username || b.email || "").toLowerCase();
        return aName.localeCompare(bName);
      })
      .slice(0, 8)
      .map((profile) => ({
        id: profile.id,
        username: profile.username || null,
        full_name: profile.full_name || null,
        email: profile.email || null,
        avatar_url: profile.avatar_url || null,
      }));

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("GET /api/society/messages/suggestions error:", error);
    return NextResponse.json({ error: "Failed to load friend suggestions" }, { status: 500 });
  }
}
