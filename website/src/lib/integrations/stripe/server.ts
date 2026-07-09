import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { decrypt } from "@/lib/utils/encryption";
import { StripeConfig } from "./client";

export interface StripeConnection {
  ok: true;
  integrationId: string;
  config: StripeConfig;
}

export interface StripeConnectionError {
  ok: false;
  errorCode: string;
  message: string;
}

export async function loadStripeConnectionForUser(
  db: Firestore,
  userId: string,
): Promise<StripeConnection | StripeConnectionError> {
  const snapshot = await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .where("user_id", "==", userId)
    .where("provider", "==", "stripe")
    .limit(1)
    .get();

  if (snapshot.empty) {
    return {
      ok: false,
      errorCode: "STRIPE_NOT_CONNECTED",
      message: "Stripe is not connected for this workspace.",
    };
  }

  const doc = snapshot.docs[0];
  const integration = doc.data() as Record<string, unknown>;

  if (!integration.access_token_enc || !integration.token_iv) {
    return {
      ok: false,
      errorCode: "STRIPE_AUTH_INCOMPLETE",
      message: "Stripe is connected, but the saved OAuth tokens are incomplete.",
    };
  }

  return {
    ok: true,
    integrationId: doc.id,
    config: {
      accessToken: decrypt(
        integration.access_token_enc as string,
        integration.token_iv as string,
      ),
      stripeUserId: integration.provider_account_id
        ? String(integration.provider_account_id)
        : undefined,
    },
  };
}
