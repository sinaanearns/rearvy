import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  addSyncJobDeletes,
  addUserScopedDeletes,
  getUserProviderIntegrations,
} from "@/lib/integrations/disconnect";

export async function POST(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const integrationSnapshot = await getUserProviderIntegrations(
    user.uid,
    "facebook"
  );

  if (integrationSnapshot.empty) {
    return NextResponse.json(
      { error: "No Facebook integration found" },
      { status: 404 }
    );
  }

  const batch = adminDb.batch();
  const integrationId = integrationSnapshot.docs[0].id;

  batch.delete(integrationSnapshot.docs[0].ref);

  await addUserScopedDeletes(batch, COLLECTIONS.FACEBOOK_PAGES, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.FACEBOOK_POSTS, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.FACEBOOK_COMMENTS, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.FACEBOOK_ANALYTICS, user.uid);
  await addSyncJobDeletes(batch, integrationId, "facebook");

  await batch.commit();

  return NextResponse.json({ success: true });
}
