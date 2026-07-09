import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { StripeConfig, StripeInvoice, StripeCharge, StripeSubscription } from "./client";

function stableDocId(...parts: string[]): string {
  return parts.map((part) => encodeURIComponent(part)).join("__");
}

async function commitBatchIfNeeded(batch: WriteBatch, writeCount: number) {
  if (writeCount > 0) {
    await batch.commit();
  }
}

export async function runStripeSync(
  db: Firestore,
  userId: string,
  integrationId: string,
  config: StripeConfig,
  data: {
    invoices: StripeInvoice[];
    charges: StripeCharge[];
    subscriptions: StripeSubscription[];
  },
) {
  await db
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId)
    .set({ last_synced_at: new Date().toISOString() }, { merge: true });

  let batch = db.batch();
  let writeCount = 0;

  for (const invoice of data.invoices) {
    batch.set(
      db.collection(COLLECTIONS.STRIPE_INVOICES).doc(stableDocId(integrationId, invoice.id)),
      {
        user_id: userId,
        integration_id: integrationId,
        invoice_id: invoice.id,
        number: invoice.number,
        status: invoice.status,
        amount_due: invoice.amount_due,
        currency: invoice.currency,
        customer_email: invoice.customer_email,
        created: invoice.created,
        hosted_invoice_url: invoice.hosted_invoice_url,
        synced_at: new Date().toISOString(),
      },
    );
    writeCount += 1;
    if (writeCount >= 450) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  for (const charge of data.charges) {
    batch.set(
      db.collection(COLLECTIONS.STRIPE_CHARGES).doc(stableDocId(integrationId, charge.id)),
      {
        user_id: userId,
        integration_id: integrationId,
        charge_id: charge.id,
        amount: charge.amount,
        currency: charge.currency,
        status: charge.status,
        customer_email: charge.customer_email,
        created: charge.created,
        description: charge.description,
        synced_at: new Date().toISOString(),
      },
    );
    writeCount += 1;
    if (writeCount >= 450) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  for (const subscription of data.subscriptions) {
    batch.set(
      db.collection(COLLECTIONS.STRIPE_SUBSCRIPTIONS).doc(stableDocId(integrationId, subscription.id)),
      {
        user_id: userId,
        integration_id: integrationId,
        subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        plan_amount: subscription.plan_amount,
        plan_currency: subscription.plan_currency,
        customer_email: subscription.customer_email,
        synced_at: new Date().toISOString(),
      },
    );
    writeCount += 1;
    if (writeCount >= 450) {
      await batch.commit();
      batch = db.batch();
      writeCount = 0;
    }
  }

  await commitBatchIfNeeded(batch, writeCount);
  return {
    invoices: data.invoices.length,
    charges: data.charges.length,
    subscriptions: data.subscriptions.length,
  };
}
