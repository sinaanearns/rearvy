import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await params;

  try {
    // 1. Get User Auth Data
    const authUser = await adminAuth.getUser(uid);

    // 2. Get User Profile
    const profileDoc = await adminDb.collection(COLLECTIONS.PROFILES).doc(uid).get();
    const profile = profileDoc.exists ? profileDoc.data() : null;

    // 3. Get User Chats (both personal and group/dm)
    const chatsSnapshot = await adminDb
      .collection(COLLECTIONS.CHATS)
      .where("participant_ids", "array-contains", uid)
      .get();
    
    // Also check for chats where they are the owner but might not be in participant_ids (unlikely but safe)
    const ownedChatsSnapshot = await adminDb
      .collection(COLLECTIONS.CHATS)
      .where("user_id", "==", uid)
      .get();

    const chatIds = new Set<string>();
    const chats: any[] = [];

    [...chatsSnapshot.docs, ...ownedChatsSnapshot.docs].forEach((doc) => {
      if (!chatIds.has(doc.id)) {
        chatIds.add(doc.id);
        chats.push({ id: doc.id, ...doc.data() });
      }
    });

    // 4. Get Messages for these chats (limit to most recent 50 per chat for now to avoid huge payload)
    const chatsWithMessages = await Promise.all(
      chats.map(async (chat) => {
        const messagesSnapshot = await adminDb
          .collection(COLLECTIONS.MESSAGES)
          .where("chat_id", "==", chat.id)
          .orderBy("created_at", "asc")
          .limit(100)
          .get();
        
        return {
          ...chat,
          messages: messagesSnapshot.docs.map((m) => ({ id: m.id, ...m.data() })),
        };
      })
    );

    // 5. Get Integrations
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", uid)
      .get();
    const integrations = integrationsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    // 6. Get Website Activity
    const eventsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_EVENTS)
      .where("user_id", "==", uid) // Assuming events have user_id if logged in
      .orderBy("timestamp", "desc")
      .limit(50)
      .get();
    const events = eventsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({
      user: {
        uid: authUser.uid,
        email: authUser.email,
        displayName: authUser.displayName,
        photoURL: authUser.photoURL,
        disabled: authUser.disabled,
        metadata: authUser.metadata,
      },
      profile,
      chats: chatsWithMessages,
      integrations,
      events,
    });
  } catch (error) {
    console.error("Error fetching user data:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch user data" },
      { status: 500 }
    );
  }
}
