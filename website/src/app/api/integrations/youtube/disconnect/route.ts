import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  addUserScopedDeletes,
  getUserProviderIntegrations,
} from "@/lib/integrations/disconnect";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("YouTubeDisconnectApi");

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const batch = adminDb.batch();

    // Delete integration record
    const integrationsSnapshot = await getUserProviderIntegrations(
      user.uid,
      "youtube"
    );
    integrationsSnapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    // Clean up all YouTube-specific synced data
    await addUserScopedDeletes(batch, COLLECTIONS.YOUTUBE_CHANNELS, user.uid);
    await addUserScopedDeletes(batch, COLLECTIONS.YOUTUBE_VIDEOS, user.uid);
    await addUserScopedDeletes(batch, COLLECTIONS.YOUTUBE_COMMENTS, user.uid);

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("YouTube disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
