import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import {
  addSyncJobDeletes,
  addUserScopedDeletes,
  getUserProviderIntegrations,
} from "@/lib/integrations/disconnect";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("GmailDisconnectApi");

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);
  if (authError) return authError;

  try {
    const integrationSnapshot = await getUserProviderIntegrations(
      user.uid,
      "gmail"
    );

    if (integrationSnapshot.empty) {
      return NextResponse.json(
        { error: "No Gmail integration found" },
        { status: 404 }
      );
    }

    const integrationIds = integrationSnapshot.docs.map((doc) => doc.id);
    const batch = adminDb.batch();

    integrationSnapshot.docs.forEach((doc) => batch.delete(doc.ref));

    await addUserScopedDeletes(batch, COLLECTIONS.GMAIL_THREADS, user.uid);
    await addUserScopedDeletes(batch, COLLECTIONS.GMAIL_MESSAGES, user.uid);

    for (const integrationId of integrationIds) {
      await addSyncJobDeletes(batch, integrationId, "gmail");
    }

    await batch.commit();

    return NextResponse.json({ success: true });
  } catch (error) {
    log.error("Gmail disconnect error:", error);
    return NextResponse.json(
      { error: "Disconnect failed" },
      { status: 500 }
    );
  }
}
