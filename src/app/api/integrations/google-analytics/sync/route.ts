import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/google-analytics/sync";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const snapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "google_analytics")
      .where("status", "==", "active")
      .limit(1)
      .get();

    if (snapshot.empty) {
      return NextResponse.json(
        { error: "No active Google Analytics integration found" },
        { status: 404 }
      );
    }

    const doc = snapshot.docs[0];
    const integration = doc.data();
    const integrationId = doc.id;

    const refreshIv = (
      integration.sync_cursor as { refresh_iv?: string } | null
    )?.refresh_iv;

    if (!integration.refresh_token_enc || !refreshIv) {
      return NextResponse.json(
        { error: "Integration missing refresh token" },
        { status: 500 }
      );
    }

    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const refreshToken = decrypt(integration.refresh_token_enc, refreshIv);
    const tokenExpiresAt = new Date(integration.token_expires_at || Date.now());

    const result = await runFullSync(
      adminDb,
      user.uid,
      integrationId,
      {
        accessToken,
        refreshToken,
        tokenExpiresAt,
      }
    );

    return NextResponse.json({
      success: true,
      synced: result,
    });
  } catch (err) {
    console.error("GA4 sync error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sync failed" },
      { status: 500 }
    );
  }
}
