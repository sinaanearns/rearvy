import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  addSyncJobDeletes,
  deleteMatchingDocs,
  getUserProviderIntegrations,
} from "@/lib/integrations/disconnect";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  const integrationSnapshot = await getUserProviderIntegrations(
    user.uid,
    "linkedin"
  );

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No LinkedIn integration found" },
      { status: 404 }
    );
  }

  const integrationId = integrationSnapshot.docs[0].id;
  const batch = adminDb.batch();
  batch.delete(integrationSnapshot.docs[0].ref);

  await addSyncJobDeletes(batch, integrationId, "linkedin");

  await batch.commit();

  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_PROFILES, "user_id", user.uid);
  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_POSTS, "user_id", user.uid);
  await deleteMatchingDocs(COLLECTIONS.LINKEDIN_COMMENTS, "user_id", user.uid);

  return NextResponse.json({ success: true });
}
