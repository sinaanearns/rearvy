import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  // Get integration to delete
  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "instagram")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No Instagram integration found" },
      { status: 404 }
    );
  }

  const integrationId = integrationSnapshot.docs[0].id;

  // Use batch to delete integration and all related data
  const batch = adminDb.batch();

  // Delete integration
  batch.delete(integrationSnapshot.docs[0].ref);

  // Delete all Instagram-specific synced data
  const accountsSnapshot = await adminDb
    .collection(COLLECTIONS.INSTAGRAM_ACCOUNTS)
    .where("user_id", "==", user.uid)
    .get();
  accountsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const postsSnapshot = await adminDb
    .collection(COLLECTIONS.INSTAGRAM_POSTS)
    .where("user_id", "==", user.uid)
    .get();
  postsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  const commentsSnapshot = await adminDb
    .collection(COLLECTIONS.INSTAGRAM_COMMENTS)
    .where("user_id", "==", user.uid)
    .get();
  commentsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();

  return NextResponse.json({ success: true });
}
