import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: { website_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { website_id } = body;
  if (!website_id) {
    return NextResponse.json(
      { error: "Missing website_id" },
      { status: 400 }
    );
  }

  try {
    // Verify website exists and belongs to user
    const websiteDoc = await adminDb
      .collection(COLLECTIONS.WEBSITES)
      .doc(website_id)
      .get();

    if (!websiteDoc.exists || websiteDoc.data()?.user_id !== user.uid) {
      return NextResponse.json({ error: "Website not found" }, { status: 404 });
    }

    const batch = adminDb.batch();

    // Delete website
    batch.delete(websiteDoc.ref);

    // Delete associated sessions, pageviews, and events
    const sessionsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_SESSIONS)
      .where("website_id", "==", website_id)
      .get();
    sessionsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const pageviewsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_PAGEVIEWS)
      .where("website_id", "==", website_id)
      .get();
    pageviewsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const eventsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_EVENTS)
      .where("website_id", "==", website_id)
      .get();
    eventsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to disconnect website:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
