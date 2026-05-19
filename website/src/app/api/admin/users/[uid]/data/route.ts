import { NextRequest, NextResponse } from "next/server";
import { getAdminSessionEmail } from "@/lib/admin-auth";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { handleApiError } from "@/lib/api-error";

// Rate limiting: max 10 queries per admin per hour
const DATA_QUERY_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const DATA_QUERY_MAX_ATTEMPTS = 10;
const dataQueryAttempts = new Map<string, { count: number; resetAt: number }>();

function isDataQueryRateLimited(adminEmail: string, targetUid: string): boolean {
  const key = `${adminEmail}:${targetUid}`;
  const now = Date.now();
  const record = dataQueryAttempts.get(key);

  if (!record || record.resetAt <= now) {
    dataQueryAttempts.set(key, { count: 1, resetAt: now + DATA_QUERY_WINDOW_MS });
    return false;
  }

  if (record.count >= DATA_QUERY_MAX_ATTEMPTS) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  const adminEmail = await getAdminSessionEmail();
  if (!adminEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { uid } = await params;

  // Rate limit this endpoint per admin + target user
  if (isDataQueryRateLimited(adminEmail, uid)) {
    return NextResponse.json(
      { error: "Too many data queries. Please try again later." },
      { status: 429 }
    );
  }

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
        // Note: metadata (created_at, last_sign_in, etc.) intentionally omitted for privacy
      },
      profile,
      chats: chatsWithMessages,
      integrations,
      events,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/admin/users/[uid]/data", { uid });
  }
}
