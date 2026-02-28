import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { adminDb } from "@/lib/firebase/admin";
import { COLLECTIONS } from "@/lib/firebase/schema";

export async function POST(request: NextRequest) {
  const { user, error: authError } = await requireAuth(request);

  if (authError) return authError;

  try {
    // Delete integration and cascade-related data
    const integrationsRef = adminDb.collection(COLLECTIONS.INTEGRATIONS);
    const integrationQuery = await integrationsRef
      .where("user_id", "==", user.uid)
      .where("provider", "==", "shopify")
      .get();

    if (!integrationQuery.empty) {
      const integrationDocId = integrationQuery.docs[0].id;
      const integrationId = integrationQuery.docs[0].data().id || integrationDocId;

      // Delete integration
      await integrationsRef.doc(integrationDocId).delete();

      // Clean up synced data
      const batch = adminDb.batch();

      // Delete products
      const productsQuery = await adminDb
        .collection(COLLECTIONS.PRODUCTS)
        .where("user_id", "==", user.uid)
        .where("integration_id", "==", integrationId)
        .get();
      productsQuery.docs.forEach((doc) => batch.delete(doc.ref));

      // Delete orders
      const ordersQuery = await adminDb
        .collection(COLLECTIONS.ORDERS)
        .where("user_id", "==", user.uid)
        .where("integration_id", "==", integrationId)
        .get();
      ordersQuery.docs.forEach((doc) => batch.delete(doc.ref));

      // Delete business metrics
      const metricsQuery = await adminDb
        .collection(COLLECTIONS.BUSINESS_METRICS)
        .where("user_id", "==", user.uid)
        .where("integration_id", "==", integrationId)
        .get();
      metricsQuery.docs.forEach((doc) => batch.delete(doc.ref));

      await batch.commit();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Shopify disconnect error:", error);
    return NextResponse.json(
      { error: "Failed to disconnect" },
      { status: 500 }
    );
  }
}
