import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const batch = adminDb.batch();

    // Delete integration record
    const integrationsSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "youtube")
      .get();

    integrationsSnapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    // Clean up all YouTube-specific synced data
    const channelsSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_CHANNELS)
      .where("user_id", "==", user.uid)
      .get();
    channelsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    const videosSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_VIDEOS)
      .where("user_id", "==", user.uid)
      .get();
    videosSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    const commentsSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_COMMENTS)
      .where("user_id", "==", user.uid)
      .get();
    commentsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    const analyticsSnapshot = await adminDb
      .collection(COLLECTIONS.YOUTUBE_ANALYTICS)
      .where("user_id", "==", user.uid)
      .get();
    analyticsSnapshot.docs.forEach(doc => batch.delete(doc.ref));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("YouTube disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
