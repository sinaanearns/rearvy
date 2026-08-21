import { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import { safeDocId } from "@/lib/firebase/doc-utils";
import { encrypt } from "@/lib/utils/encryption";

const RAZORPAY_API_BASE = "https://api.razorpay.com/v1";
const MAX_PAGE_SIZE = 100;
const DEFAULT_BACKFILL_DAYS = 180;
const PLACEHOLDER_CREDENTIAL = "razorpay-env-placeholder";

type RazorpayApiPayment = {
  id: string;
  amount: number;
  currency?: string | null;
  status?: string | null;
  order_id?: string | null;
  method?: string | null;
  amount_refunded?: number | null;
  description?: string | null;
  bank?: string | null;
  wallet?: string | null;
  vpa?: string | null;
  captured?: boolean;
  notes?: Record<string, unknown> | null;
  upi?: {
    vpa?: string | null;
  } | null;
  created_at?: number | null;
};

type RazorpayPaymentsResponse = {
  items?: RazorpayApiPayment[];
};

type StoredIntegration = {
  last_synced_at?: Date | string | { toDate?: () => Date } | null;
  sync_cursor?: Record<string, unknown> | null;
};

export type RazorpaySyncResult = {
  payments: number;
  methods: Record<string, number>;
};

function readEnv(name: string) {
  return process.env[name]?.trim() || "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function getRequiredEnv(name: string) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getRazorpayKeyId() {
  return getRequiredEnv("RAZORPAY_KEY_ID");
}

function getRazorpayKeySecret() {
  return getRequiredEnv("RAZORPAY_KEY_SECRET");
}

function toAuthHeader() {
  const encoded = Buffer.from(
    `${getRazorpayKeyId()}:${getRazorpayKeySecret()}`
  ).toString("base64");
  return `Basic ${encoded}`;
}

function getBackfillDays() {
  return DEFAULT_BACKFILL_DAYS;
}

function toIsoFromUnix(value?: number | null) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return new Date(Number(value) * 1000).toISOString();
}

function toUnixSeconds(date: Date) {
  return Math.floor(date.getTime() / 1000);
}

function toMajorUnits(value?: number | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  return parsed / 100;
}

function normalizeMethod(method?: string | null) {
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

function readDateValue(value: StoredIntegration["last_synced_at"]) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  if (typeof value === "object" && typeof value.toDate === "function") {
    const parsed = value.toDate();
    return parsed instanceof Date && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;
  }

  return null;
}

function normalizeRazorpayPayment(value: unknown): RazorpayApiPayment | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = readString(value.id);
  const amount = readNumber(value.amount);

  if (!id || amount === undefined) {
    return null;
  }

  const upi = isRecord(value.upi)
    ? {
        vpa: readString(value.upi.vpa) ?? null,
      }
    : null;

  const notes = isRecord(value.notes) ? value.notes : null;

  return {
    id,
    amount,
    currency: readString(value.currency) ?? null,
    status: readString(value.status) ?? null,
    order_id: readString(value.order_id) ?? null,
    method: readString(value.method) ?? null,
    amount_refunded: readNumber(value.amount_refunded) ?? null,
    description: readString(value.description) ?? null,
    bank: readString(value.bank) ?? null,
    wallet: readString(value.wallet) ?? null,
    vpa: readString(value.vpa) ?? null,
    captured: readBoolean(value.captured),
    notes,
    upi,
    created_at: readNumber(value.created_at) ?? null,
  };
}

function normalizeRazorpayPaymentsResponse(
  value: unknown
): RazorpayPaymentsResponse {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    return {};
  }

  return {
    items: value.items.flatMap((item) => {
      const payment = normalizeRazorpayPayment(item);
      return payment ? [payment] : [];
    }),
  };
}

async function razorpayRequest(path: string) {
  const response = await fetch(`${RAZORPAY_API_BASE}${path}`, {
    method: "GET",
    headers: {
      Authorization: toAuthHeader(),
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Razorpay request failed with status ${response.status}: ${errorText.slice(0, 300)}`
    );
  }

  return response.json().catch(() => null) as Promise<unknown>;
}

async function fetchAllPayments(params: { from: number; to: number }) {
  const payments: RazorpayApiPayment[] = [];
  let skip = 0;

  while (true) {
    const query = new URLSearchParams({
      from: String(params.from),
      to: String(params.to),
      count: String(MAX_PAGE_SIZE),
      skip: String(skip),
    });

    const response = normalizeRazorpayPaymentsResponse(
      await razorpayRequest(`/payments?${query.toString()}`)
    );
    const items = Array.isArray(response.items) ? response.items : [];

    payments.push(...items);

    if (items.length < MAX_PAGE_SIZE) {
      break;
    }

    skip += items.length;
  }

  return payments;
}

function buildPaymentRow(params: {
  userId: string;
  integrationId: string;
  payment: RazorpayApiPayment;
  syncedAt: string;
}) {
  const createdAtSource = toIsoFromUnix(params.payment.created_at) ?? params.syncedAt;
  const isCaptured =
    params.payment.captured === true ||
    params.payment.status === "captured" ||
    params.payment.status === "refunded";

  return {
    user_id: params.userId,
    integration_id: params.integrationId,
    payment_id: params.payment.id,
    order_id: params.payment.order_id ?? null,
    amount: toMajorUnits(params.payment.amount),
    currency: params.payment.currency?.toUpperCase() || "INR",
    status: params.payment.status || null,
    method: params.payment.method || null,
    amount_refunded: toMajorUnits(params.payment.amount_refunded),
    description: params.payment.description || null,
    notes:
      params.payment.notes && typeof params.payment.notes === "object"
        ? params.payment.notes
        : {},
    vpa: params.payment.vpa || params.payment.upi?.vpa || null,
    bank: params.payment.bank || null,
    wallet: params.payment.wallet || null,
    captured_at: isCaptured ? createdAtSource : null,
    created_at_source: createdAtSource,
    synced_at: params.syncedAt,
    created_at: createdAtSource,
    updated_at: params.syncedAt,
  };
}

async function upsertPayments(
  adminDb: Firestore,
  rows: Array<ReturnType<typeof buildPaymentRow>>
) {
  for (let index = 0; index < rows.length; index += 400) {
    const chunk = rows.slice(index, index + 400);
    const batch = adminDb.batch();

    for (const row of chunk) {
      const docRef = adminDb
        .collection(COLLECTIONS.RAZORPAY_PAYMENTS)
        .doc(safeDocId(row.integration_id, row.payment_id));
      batch.set(docRef, row, { merge: true });
    }

    await batch.commit();
  }
}

export function isRazorpayCollectionsConfigured() {
  return Boolean(readEnv("RAZORPAY_KEY_ID") && readEnv("RAZORPAY_KEY_SECRET"));
}

export function buildRazorpayEnvIntegrationData(userId: string) {
  const { encrypted, iv } = encrypt(PLACEHOLDER_CREDENTIAL);
  const nowIso = new Date().toISOString();

  return {
    user_id: userId,
    provider: "razorpay" as const,
    provider_account_id: "env",
    provider_account_name: "Razorpay collections",
    access_token_enc: encrypted,
    token_iv: iv,
    scopes: ["payments:read"],
    token_expires_at: null,
    status: "active" as const,
    sync_cursor: {
      credential_mode: "env",
      backfill_days: getBackfillDays(),
    },
    updated_at: nowIso,
  };
}

export async function runFullSync(
  adminDb: Firestore,
  userId: string,
  integrationId: string
): Promise<RazorpaySyncResult> {
  if (!isRazorpayCollectionsConfigured()) {
    throw new Error(
      "Razorpay integration is not configured. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET."
    );
  }

  const integrationRef = adminDb
    .collection(COLLECTIONS.INTEGRATIONS)
    .doc(integrationId);
  const integrationSnapshot = await integrationRef.get();
  const integration = integrationSnapshot.data() as StoredIntegration | undefined;

  if (!integration) {
    throw new Error("Razorpay integration not found for sync.");
  }

  const now = new Date();
  const lastSyncedAt = readDateValue(integration.last_synced_at);
  const backfillStart = new Date(
    now.getTime() - getBackfillDays() * 24 * 60 * 60 * 1000
  );
  const fromDate = lastSyncedAt || backfillStart;

  const payments = await fetchAllPayments({
    from: toUnixSeconds(fromDate),
    to: toUnixSeconds(now),
  });

  const syncedAt = now.toISOString();
  const rows = payments.map((payment) =>
    buildPaymentRow({
      userId,
      integrationId,
      payment,
      syncedAt,
    })
  );

  if (rows.length > 0) {
    await upsertPayments(adminDb, rows);
  }

  const methods = rows.reduce<Record<string, number>>((acc, row) => {
    const key = normalizeMethod(row.method);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const latestSourceDate = rows
    .map((row) => row.created_at_source)
    .sort()
    .at(-1);

  await integrationRef.set(
    {
      status: "active",
      last_synced_at: syncedAt,
      sync_cursor: {
        ...(integration.sync_cursor || {}),
        credential_mode: "env",
        backfill_days: getBackfillDays(),
        ...(latestSourceDate
          ? { last_payment_created_at: latestSourceDate }
          : {}),
      },
      updated_at: syncedAt,
    },
    { merge: true }
  );

  return {
    payments: rows.length,
    methods,
  };
}
