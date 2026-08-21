import { NextRequest, NextResponse } from "next/server";

import admin from "@/lib/firebase/admin";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { getUserFromRequest } from "@/lib/firebase/server";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("AccountDataDeleteApi");

const USER_SCOPED_COLLECTIONS = [
  COLLECTIONS.PROJECTS,
  COLLECTIONS.CHATS,
  COLLECTIONS.INTEGRATIONS,
  COLLECTIONS.INTEGRATION_SYNC_JOBS,
  COLLECTIONS.EXCEL_WORKBOOKS,
  COLLECTIONS.EXCEL_ROWS,
  COLLECTIONS.BUSINESS_METRICS,
  COLLECTIONS.PRODUCTS,
  COLLECTIONS.ORDERS,
  COLLECTIONS.RAZORPAY_PAYMENTS,
  COLLECTIONS.PRODUCT_REVIEWS,
  COLLECTIONS.YOUTUBE_CHANNELS,
  COLLECTIONS.YOUTUBE_VIDEOS,
  COLLECTIONS.YOUTUBE_COMMENTS,
  COLLECTIONS.YOUTUBE_ANALYTICS,
  COLLECTIONS.INSTAGRAM_ACCOUNTS,
  COLLECTIONS.INSTAGRAM_POSTS,
  COLLECTIONS.INSTAGRAM_COMMENTS,
  COLLECTIONS.INSTAGRAM_ANALYTICS,
  COLLECTIONS.FACEBOOK_PAGES,
  COLLECTIONS.FACEBOOK_POSTS,
  COLLECTIONS.FACEBOOK_COMMENTS,
  COLLECTIONS.FACEBOOK_ANALYTICS,
  COLLECTIONS.GITHUB_REPOS,
  COLLECTIONS.GITHUB_ISSUES,
  COLLECTIONS.GITHUB_PULL_REQUESTS,
  COLLECTIONS.WEBSITES,
  COLLECTIONS.WEBSITE_SESSIONS,
  COLLECTIONS.WEBSITE_PAGEVIEWS,
  COLLECTIONS.WEBSITE_EVENTS,
  COLLECTIONS.MEMORIES,
  COLLECTIONS.INSIGHTS,
  COLLECTIONS.WHISPERNET_WATCHERS,
  COLLECTIONS.WHISPERNET_CONTENT_ITEMS,
  COLLECTIONS.WHISPERNET_MENTIONS,
  COLLECTIONS.WHISPERNET_FORECASTS,
  COLLECTIONS.WHISPERNET_ALERTS,
  COLLECTIONS.WHISPERNET_PROCESSING_JOBS,
  COLLECTIONS.GMAIL_MESSAGES,
  COLLECTIONS.GMAIL_THREADS,
  COLLECTIONS.FEEDBACK_SUBMISSIONS,
  COLLECTIONS.TRADER_SIGNALS,
] as const;

async function deleteMatchingDocs(
  collectionName: string,
  fieldName: string,
  fieldValue: string
) {
  let deletedCount = 0;

  while (true) {
    const snapshot = await adminDb
      .collection(collectionName)
      .where(fieldName, "==", fieldValue)
      .limit(250)
      .get();

    if (snapshot.empty) {
      break;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
      deletedCount += 1;
    });
    await batch.commit();

    if (snapshot.size < 250) {
      break;
    }
  }

  return deletedCount;
}

async function deleteMessagesForUserChats(userId: string) {
  let totalDeleted = 0;
  let lastChatDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (true) {
    let query = adminDb
      .collection(COLLECTIONS.CHATS)
      .where("user_id", "==", userId)
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(100);

    if (lastChatDoc) {
      query = query.startAfter(lastChatDoc);
    }

    const chatSnapshot = await query.get();

    if (chatSnapshot.empty) {
      break;
    }

    for (const chatDoc of chatSnapshot.docs) {
      totalDeleted += await deleteMatchingDocs(
        COLLECTIONS.MESSAGES,
        "chat_id",
        chatDoc.id
      );
    }

    if (chatSnapshot.size < 100) {
      break;
    }

    lastChatDoc = chatSnapshot.docs[chatSnapshot.docs.length - 1] ?? null;
  }

  return totalDeleted;
}

export async function DELETE(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = data.user.id;

    let deletedDocs = 0;

    deletedDocs += await deleteMessagesForUserChats(userId);

    for (const collectionName of USER_SCOPED_COLLECTIONS) {
      deletedDocs += await deleteMatchingDocs(collectionName, "user_id", userId);
    }

    deletedDocs += await deleteMatchingDocs(
      COLLECTIONS.PROFILE_FOLLOW_REQUESTS,
      "requester_id",
      userId
    );
    deletedDocs += await deleteMatchingDocs(
      COLLECTIONS.PROFILE_FOLLOW_REQUESTS,
      "target_user_id",
      userId
    );

    await adminDb.collection(COLLECTIONS.PROFILES).doc(userId).delete();

    await adminAuth.deleteUser(userId);

    return NextResponse.json({
      success: true,
      deleted_docs: deletedDocs,
    });
  } catch (error) {
    log.error("DELETE /api/account/data-delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete account data" },
      { status: 500 }
    );
  }
}
