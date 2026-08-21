import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

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

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const integrationSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", user.uid)
    .where("provider", "==", "linkedin")
    .get();

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No LinkedIn integration found" },
      { status: 404 }
    );
  }

  const integrationId = integrationSnapshot.docs[0].id;
  const batch = adminDb.batch();
  batch.delete(integrationSnapshot.docs[0].ref);

  const syncJobsSnapshot = await adminDb
    .collection(COLLECTIONS.INTEGRATION_SYNC_JOBS)
    .where("integration_id", "==", integrationId)
    .where("provider", "==", "linkedin")
    .get();
  syncJobsSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

  await batch.commit();

  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_PROFILES, "user_id", user.uid);
  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_POSTS, "user_id", user.uid);
  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_COMMENTS, "user_id", user.uid);

  return NextResponse.json({ success: true });
}
