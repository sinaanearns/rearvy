export type ShopifyOrderRecord = {
  total_price?: number;
  currency?: string | null;
  financial_status?: string | null;
  placed_at?: string | null;
};

export type RazorpayPaymentRecord = {
  amount?: number;
  amount_refunded?: number;
  currency?: string | null;
  status?: string | null;
  method?: string | null;
  created_at_source?: string | null;
  captured_at?: string | null;
};

type ChannelSegment = {
  label: string;
  amount: number;
  percentage: number;
};

type MethodSegment = {
  method: string;
  label: string;
  amount: number;
  percentage: number;
};

type DaySegment = {
  label: string;
  total: number;
  shopify: number;
  razorpay: number;
};

export type CollectionsSummary = {
  currency: string;
  shopifyTotal: number;
  razorpayTotal: number;
  combinedTotal: number;
  channelSegments: ChannelSegment[];
  methodSegments: MethodSegment[];
  daySegments: DaySegment[];
};

const SHOPIFY_EXCLUDED_STATUSES = new Set(["pending", "voided", "refunded"]);
const RAZORPAY_COLLECTED_STATUSES = new Set(["captured", "refunded"]);

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickCurrency(
  shopifyOrders: ShopifyOrderRecord[],
  razorpayPayments: RazorpayPaymentRecord[]
) {
  const values = [
    ...razorpayPayments.map((payment) => payment.currency),
    ...shopifyOrders.map((order) => order.currency),
  ];

  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim().toUpperCase();
    }
  }

  return "INR";
}

function normalizeDay(value?: string | null) {
  if (typeof value !== "string" || value.length < 10) {
    return null;
  }

  return value.slice(0, 10);
}

function formatMethodLabel(method: string) {
  if (method === "upi") return "UPI";
  if (method === "card") return "Card";
  if (method === "netbanking") return "Netbanking";
  if (method === "wallet") return "Wallet";
  return "Other";
}

function calculatePercentage(amount: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return (amount / total) * 100;
}

export function normalizeRazorpayMethod(method?: string | null) {
  if (
    method === "upi" ||
    method === "card" ||
    method === "netbanking" ||
    method === "wallet"
  ) {
    return method;
  }

  return "other";
}

function getShopifyCollectedAmount(order: ShopifyOrderRecord) {
  const status = order.financial_status?.toLowerCase() || null;
  if (status && SHOPIFY_EXCLUDED_STATUSES.has(status)) {
    return 0;
  }

  return toNumber(order.total_price);
}

function getRazorpayCollectedAmount(payment: RazorpayPaymentRecord) {
  const status = payment.status?.toLowerCase() || null;
  if (!status || !RAZORPAY_COLLECTED_STATUSES.has(status)) {
    return 0;
  }

  return Math.max(
    toNumber(payment.amount) - toNumber(payment.amount_refunded),
    0
  );
}

export function summarizeCollectionsDataset(params: {
  shopifyOrders: ShopifyOrderRecord[];
  razorpayPayments: RazorpayPaymentRecord[];
}): CollectionsSummary {
  const currency = pickCurrency(params.shopifyOrders, params.razorpayPayments);

  const dayBuckets = new Map<
    string,
    {
      shopify: number;
      razorpay: number;
    }
  >();

  const methodTotals = new Map<string, number>();

  let shopifyTotal = 0;
  for (const order of params.shopifyOrders) {
    const amount = getShopifyCollectedAmount(order);
    if (amount <= 0) continue;

    shopifyTotal += amount;

    const day = normalizeDay(order.placed_at);
    if (!day) continue;

    const existing = dayBuckets.get(day) || { shopify: 0, razorpay: 0 };
    existing.shopify += amount;
    dayBuckets.set(day, existing);
  }

  let razorpayTotal = 0;
  for (const payment of params.razorpayPayments) {
    const amount = getRazorpayCollectedAmount(payment);
    if (amount <= 0) continue;

    razorpayTotal += amount;

    const method = normalizeRazorpayMethod(payment.method);
    methodTotals.set(method, (methodTotals.get(method) || 0) + amount);

    const day = normalizeDay(payment.captured_at || payment.created_at_source);
    if (!day) continue;

    const existing = dayBuckets.get(day) || { shopify: 0, razorpay: 0 };
    existing.razorpay += amount;
    dayBuckets.set(day, existing);
  }

  const combinedTotal = shopifyTotal + razorpayTotal;

  const channelSegments: ChannelSegment[] = [
    {
      label: "Shopify",
      amount: shopifyTotal,
      percentage: calculatePercentage(shopifyTotal, combinedTotal),
    },
    {
      label: "Razorpay",
      amount: razorpayTotal,
      percentage: calculatePercentage(razorpayTotal, combinedTotal),
    },
  ].filter((segment) => segment.amount > 0);

  const methodSegments = Array.from(methodTotals.entries())
    .map(([method, amount]) => ({
      method,
      label: formatMethodLabel(method),
      amount,
      percentage: calculatePercentage(amount, razorpayTotal),
    }))
    .sort((left, right) => right.amount - left.amount);

  const daySegments = Array.from(dayBuckets.entries())
    .map(([label, value]) => ({
      label,
      total: value.shopify + value.razorpay,
      shopify: value.shopify,
      razorpay: value.razorpay,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return {
    currency,
    shopifyTotal,
    razorpayTotal,
    combinedTotal,
    channelSegments,
    methodSegments,
    daySegments,
  };
}
