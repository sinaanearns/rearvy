import { NextResponse, type NextRequest } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("WebsiteDisconnectApi");

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  let body: Record<string, unknown>;
  try {
    body = await readJsonRecord(request);
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    throw error;
  }

  const website_id = optionalString(body.website_id);
  if (!website_id) {
    return NextResponse.json(
      { error: "Missing website_id" },
      { status: 400 }
    );
  }

  try {
    // Resolve website by Firestore doc id first, then fall back to site_id
    // for compatibility with older clients that sent tracking IDs.
    let websiteDoc = await adminDb
      .collection(COLLECTIONS.WEBSITES)
      .doc(website_id)
      .get();

    if (!websiteDoc.exists || websiteDoc.data()?.user_id !== user.uid) {
      const fallbackSnap = await adminDb
        .collection(COLLECTIONS.WEBSITES)
        .where("user_id", "==", user.uid)
        .where("site_id", "==", website_id)
        .limit(1)
        .get();

      if (fallbackSnap.empty) {
        return NextResponse.json({ error: "Website not found" }, { status: 404 });
      }

      websiteDoc = fallbackSnap.docs[0];
    }

    const resolvedWebsiteId = websiteDoc.id;

    const batch = adminDb.batch();

    // Delete website
    batch.delete(websiteDoc.ref);

    // Delete associated sessions, pageviews, and events
    const sessionsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_SESSIONS)
      .where("website_id", "==", resolvedWebsiteId)
      .get();
    sessionsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const pageviewsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_PAGEVIEWS)
      .where("website_id", "==", resolvedWebsiteId)
      .get();
    pageviewsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    const eventsSnapshot = await adminDb
      .collection(COLLECTIONS.WEBSITE_EVENTS)
      .where("website_id", "==", resolvedWebsiteId)
      .get();
    eventsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Failed to disconnect website:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
