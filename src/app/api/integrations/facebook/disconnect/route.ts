import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "facebook")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No Facebook integration found" },
      { status: 404 }
    );
  }

  const batch = adminDb.batch();
  const integrationId = integrationSnapshot.docs[0].id;

  batch.delete(integrationSnapshot.docs[0].ref);

  const pagesSnapshot = await adminDb
    .collection(COLLECTIONS.FACEBOOK_PAGES)
    .where("user_id", "==", user.uid)
    .get();
  pagesSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const postsSnapshot = await adminDb
    .collection(COLLECTIONS.FACEBOOK_POSTS)
    .where("user_id", "==", user.uid)
    .get();
  postsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const commentsSnapshot = await adminDb
    .collection(COLLECTIONS.FACEBOOK_COMMENTS)
    .where("user_id", "==", user.uid)
    .get();
  commentsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const analyticsSnapshot = await adminDb
    .collection(COLLECTIONS.FACEBOOK_ANALYTICS)
    .where("user_id", "==", user.uid)
    .get();
  analyticsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const syncJobsSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
    .where("integration_id", "==", integrationId)
    .where("provider", "==", "facebook")
    .get();
  syncJobsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();

  return NextResponse.json({ success: true });
}
