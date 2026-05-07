import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRazorpayMethod,
  summarizeCollectionsDataset,
} from "./collections-shared.ts";

test("returns zero totals when no collection data exists", () => {
  const summary = summarizeCollectionsDataset({
    shopifyOrders: [],
    razorpayPayments: [],
  });

  assert.equal(summary.currency, "INR");
  assert.equal(summary.shopifyTotal, 0);
  assert.equal(summary.razorpayTotal, 0);
  assert.equal(summary.combinedTotal, 0);
  assert.deepEqual(summary.channelSegments, []);
  assert.deepEqual(summary.methodSegments, []);
  assert.deepEqual(summary.daySegments, []);
});

test("combines Shopify and Razorpay collections without counting failed or pending payments", () => {
  const summary = summarizeCollectionsDataset({
    shopifyOrders: [
      {
        total_price: 1200,
        currency: "INR",
        financial_status: "paid",
        placed_at: "2026-03-01T10:00:00.000Z",
      },
      {
        total_price: 400,
        currency: "INR",
        financial_status: "pending",
        placed_at: "2026-03-01T12:00:00.000Z",
      },
      {
        total_price: 250,
        currency: "INR",
        financial_status: "refunded",
        placed_at: "2026-03-02T10:00:00.000Z",
      },
    ],
    razorpayPayments: [
      {
        amount: 700,
        amount_refunded: 0,
        currency: "INR",
        status: "captured",
        method: "upi",
        created_at_source: "2026-03-01T09:00:00.000Z",
        captured_at: "2026-03-01T09:00:00.000Z",
      },
      {
        amount: 500,
        amount_refunded: 100,
        currency: "INR",
        status: "refunded",
        method: "card",
        created_at_source: "2026-03-02T09:00:00.000Z",
        captured_at: "2026-03-02T09:00:00.000Z",
      },
      {
        amount: 999,
        amount_refunded: 0,
        currency: "INR",
        status: "failed",
        method: "wallet",
        created_at_source: "2026-03-02T10:00:00.000Z",
        captured_at: null,
      },
    ],
  });

  assert.equal(summary.shopifyTotal, 1200);
  assert.equal(summary.razorpayTotal, 1100);
  assert.equal(summary.combinedTotal, 2300);
  assert.deepEqual(summary.channelSegments, [
    {
      label: "Shopify",
      amount: 1200,
      percentage: (1200 / 2300) * 100,
    },
    {
      label: "Razorpay",
      amount: 1100,
      percentage: (1100 / 2300) * 100,
    },
  ]);
  assert.deepEqual(
    summary.methodSegments.map((segment) => ({
      method: segment.method,
      amount: segment.amount,
    })),
    [
      { method: "upi", amount: 700 },
      { method: "card", amount: 400 },
    ]
  );
  assert.deepEqual(summary.daySegments, [
    {
      label: "2026-03-01",
      total: 1900,
      shopify: 1200,
      razorpay: 700,
    },
    {
      label: "2026-03-02",
      total: 400,
      shopify: 0,
      razorpay: 400,
    },
  ]);
});

test("normalizes unsupported Razorpay methods into other", () => {
  assert.equal(normalizeRazorpayMethod("upi"), "upi");
  assert.equal(normalizeRazorpayMethod("card"), "card");
  assert.equal(normalizeRazorpayMethod("netbanking"), "netbanking");
  assert.equal(normalizeRazorpayMethod("wallet"), "wallet");
  assert.equal(normalizeRazorpayMethod("emi"), "other");
  assert.equal(normalizeRazorpayMethod(null), "other");
});
