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

  // Get integration to delete
  const integrationSnapshot = await getUserProviderIntegrations(
    user.uid,
    "instagram"
  );

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
  await addUserScopedDeletes(batch, COLLECTIONS.INSTAGRAM_ACCOUNTS, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.INSTAGRAM_POSTS, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.INSTAGRAM_COMMENTS, user.uid);
  await addUserScopedDeletes(batch, COLLECTIONS.INSTAGRAM_ANALYTICS, user.uid);
  await addSyncJobDeletes(batch, integrationId, "instagram");

  await batch.commit();

  return NextResponse.json({ success: true });
}
