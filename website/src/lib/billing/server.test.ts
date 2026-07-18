import assert from "node:assert/strict";
import test from "node:test";

import { normalizePaidBillingPlan } from "./shared";
import { createProCheckoutOrder, verifyProCheckoutPayment } from "./server";

test("normalizePaidBillingPlan falls back to pro for supported billing plans", () => {
  assert.equal(normalizePaidBillingPlan("business"), "business");
  assert.equal(normalizePaidBillingPlan("pro"), "pro");
  assert.equal(normalizePaidBillingPlan("unknown"), "pro");
});

test("checkout helpers return structured placeholders for local development", async () => {
  const order = await createProCheckoutOrder({
    email: "user@example.com",
    fullName: "Example User",
    source: "signup",
  });

  assert.equal(order.provider, "razorpay");
  assert.equal(order.status, "created");

  const verification = await verifyProCheckoutPayment({
    orderId: order.id,
    paymentId: "payment-placeholder",
    signature: "signature-placeholder",
  });

  assert.equal(verification.verified, true);
  assert.equal(verification.plan, "pro");
});
