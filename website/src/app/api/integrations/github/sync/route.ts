import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/github/sync";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GitHubSyncApi");

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) {
    return authError;
  }

  try {
    const integrationSnapshot = await adminDb
      .collection(COLLECTIONS.INTEGRATIONS)
      .where("user_id", "==", user.uid)
      .where("provider", "==", "github")
      .get();

    if (integrationSnapshot.empty) {
      return NextResponse.json(
        { error: "No GitHub integration found" },
        { status: 404 }
      );
    }

    const integration = integrationSnapshot.docs[0].data();
    if (
      typeof integration.access_token_enc !== "string" ||
      typeof integration.token_iv !== "string"
    ) {
      return NextResponse.json(
        { error: "GitHub integration needs to be reconnected" },
        { status: 409 }
      );
    }

    const accessToken = decrypt(integration.access_token_enc, integration.token_iv);

    const synced = await runFullSync(
      adminDb,
      user.uid,
      integrationSnapshot.docs[0].id,
      { accessToken }
    );

    return NextResponse.json({ success: true, synced });
  } catch (error) {
    log.error("GitHub sync error:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}
