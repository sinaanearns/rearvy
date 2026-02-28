import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { runFullSync } from "@/lib/integrations/shopify/sync";
import { normalizeShopifyDomain } from "@/lib/integrations/shopify/security";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);

  if (authError) return authError;

  // Get integration with encrypted token
  const integrationsRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
  const query = await integrationsRef
    .where("user_id", "==", user.uid)
    .where("provider", "==", "shopify")
    .where("status", "==", "active")
    .limit(1)
    .get();

  if (query.empty) {
    return NextResponse.json(
      { error: "No active Shopify integration found" },
      { status: 404 }
    );
  }

  const integration = { id: query.docs[0].id, ...query.docs[0].data() } as any;

  try {
    const isDemoIntegration = Boolean(
      (integration.sync_cursor as { demo?: boolean } | null)?.demo
    );

    if (isDemoIntegration) {
      const syncedAt = new Date();
      await integrationsRef.doc(integration.id).update({ last_synced_at: syncedAt });

      const [productsSnapshot, ordersSnapshot] = await Promise.all([
        adminDb
          .collection(COLLECTIONS.PRODUCTS)
          .where("user_id", "==", user.uid)
          .where("integration_id", "==", integration.id)
          .get(),
        adminDb
          .collection(COLLECTIONS.ORDERS)
          .where("user_id", "==", user.uid)
          .where("integration_id", "==", integration.id)
          .get(),
      ]);

      const syncJobsRef = adminDb.collection(COLLECTIONS.INTEGRATION_SYNC_JOBS);
      const syncJobQuery = await syncJobsRef
        .where("integration_id", "==", integration.id)
        .where("provider", "==", "shopify")
        .limit(1)
        .get();

      if (!syncJobQuery.empty) {
        await syncJobsRef.doc(syncJobQuery.docs[0].id).update({
          status: "succeeded",
          next_retry_at: null,
          last_error: null,
        });
      }

      return NextResponse.json({
        success: true,
        demo: true,
        synced: {
          products: productsSnapshot.size || 0,
          orders: ordersSnapshot.size || 0,
          metrics: 0,
          insights: 0,
        },
      });
    }

    const accessToken = decrypt(
      integration.access_token_enc,
      integration.token_iv
    );
    const rawStoredDomain = (
      integration.sync_cursor as { shop_domain?: string } | null
    )?.shop_domain;

    const fallbackDomain = integration.provider_account_name
      ?.match(/\(([^)]+)\)/)?.[1];

    const shopDomain = normalizeShopifyDomain(rawStoredDomain || fallbackDomain || "");

    if (!shopDomain) {
      throw new Error("Could not determine shop domain");
    }

    const result = await runFullSync(
      adminDb,
      user.uid,
      integration.id,
      { shopDomain, accessToken }
    );

    const syncJobsRef = adminDb.collection(COLLECTIONS.INTEGRATION_SYNC_JOBS);
    const syncJobQuery = await syncJobsRef
      .where("integration_id", "==", integration.id)
      .where("provider", "==", "shopify")
      .limit(1)
      .get();

    if (!syncJobQuery.empty) {
      await syncJobsRef.doc(syncJobQuery.docs[0].id).update({
        status: "succeeded",
        next_retry_at: null,
        last_error: null,
      });
    }

    return NextResponse.json({ success: true, synced: result });
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Sync failed";
    console.error("Shopify sync error:", error);

    // Mark integration as error if token is invalid
    if (message.includes("401") || message.includes("403")) {
      await integrationsRef.doc(integration.id).update({ status: "error" });
    }

    const syncJobsRef = adminDb.collection(COLLECTIONS.INTEGRATION_SYNC_JOBS);
    const syncJobQuery = await syncJobsRef
      .where("integration_id", "==", integration.id)
      .where("provider", "==", "shopify")
      .limit(1)
      .get();

    if (!syncJobQuery.empty) {
      await syncJobsRef.doc(syncJobQuery.docs[0].id).update({
        status: "failed",
        last_error: message,
        next_retry_at: null,
      });
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
