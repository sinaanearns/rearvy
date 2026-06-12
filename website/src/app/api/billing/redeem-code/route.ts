import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { handleApiError } from "@/lib/api-error";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { normalizeProfileAvatarUrl } from "@/lib/profile/profile-normalization";
import type { PaidBillingPlan } from "@/lib/billing/shared";

export const runtime = "nodejs";

const REDEEM_CODES_COLLECTION = "billing_redeem_codes";
const REDEEM_USES_COLLECTION = "billing_redeem_code_uses";

function normalizeRedeemCode(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 80);
}

function getEnvRedeemCodes() {
  const planByCode = new Map<string, PaidBillingPlan>();

  for (const code of (process.env.REARVY_PRO_REDEEM_CODES || "")
    .split(",")
    .map((item) => normalizeRedeemCode(item))
    .filter(Boolean)) {
    planByCode.set(code, "pro");
  }

  for (const code of (process.env.REARVY_BUSINESS_REDEEM_CODES || "")
    .split(",")
    .map((item) => normalizeRedeemCode(item))
    .filter(Boolean)) {
    planByCode.set(code, "business");
  }

  return planByCode;
}

function normalizePaidPlan(value: unknown): PaidBillingPlan {
  return value === "business" ? "business" : "pro";
}

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = data.user;

    const body = await readJsonRecord(request);
    const code = normalizeRedeemCode(body.code);

    if (!code) {
      return NextResponse.json({ error: "Redeem code is required." }, { status: 400 });
    }

    const envCodes = getEnvRedeemCodes();
    const codeRef = adminDb.collection(REDEEM_CODES_COLLECTION).doc(code);
    const useRef = adminDb.collection(REDEEM_USES_COLLECTION).doc(`${code}_${user.id}`);
    const profileRef = adminDb.collection("profiles").doc(user.id);
    let activatedPlan: PaidBillingPlan = "pro";

    await adminDb.runTransaction(async (transaction) => {
      const [codeSnap, useSnap, profileSnap] = await Promise.all([
        transaction.get(codeRef),
        transaction.get(useRef),
        transaction.get(profileRef),
      ]);

      if (useSnap.exists) {
        throw new Error("This redeem code has already been used by this account.");
      }

      const codeData = codeSnap.exists ? codeSnap.data() || {} : null;
      const envPlan = envCodes.get(code);

      if (!envPlan && !codeData) {
        throw new Error("Redeem code is invalid.");
      }

      if (codeData?.active === false) {
        throw new Error("Redeem code is no longer active.");
      }

      const plan = codeData ? normalizePaidPlan(codeData.plan) : envPlan || "pro";
      activatedPlan = plan;

      const usedBy = Array.isArray(codeData?.used_by)
        ? codeData.used_by.filter((item): item is string => typeof item === "string")
        : [];
      const maxUses =
        typeof codeData?.max_uses === "number" && Number.isFinite(codeData.max_uses)
          ? Math.max(1, Math.floor(codeData.max_uses))
          : null;

      if (maxUses !== null && usedBy.length >= maxUses) {
        throw new Error("Redeem code has reached its usage limit.");
      }

      if (usedBy.includes(user.id)) {
        throw new Error("This redeem code has already been used by this account.");
      }

      const existingProfile = profileSnap.data() || {};
      const existingFullName = normalizeRearvyDisplayText(existingProfile.full_name) || "";
      const existingBusinessName =
        normalizeRearvyDisplayText(existingProfile.business_name) || null;
      const existingAvatarUrl = normalizeProfileAvatarUrl(existingProfile.avatar_url);
      transaction.set(
        profileRef,
        {
          email: user.email || existingProfile.email || "",
          full_name: existingFullName,
          avatar_url: existingAvatarUrl,
          business_name: existingBusinessName,
          business_type: existingProfile.business_type || null,
          onboarding_completed: existingProfile.onboarding_completed || false,
          timezone: existingProfile.timezone || "UTC",
          currency: existingProfile.currency || "USD",
          plan,
          created_at: existingProfile.created_at || new Date(),
          updated_at: new Date(),
        },
        { merge: true }
      );

      transaction.set(
        useRef,
        {
          code,
          plan,
          user_id: user.id,
          email: user.email || null,
          redeemed_at: new Date(),
        },
        { merge: true }
      );

      if (codeData) {
        transaction.set(
          codeRef,
          {
            used_by: Array.from(new Set([...usedBy, user.id])),
            used_count: usedBy.includes(user.id) ? usedBy.length : usedBy.length + 1,
            updated_at: new Date(),
          },
          { merge: true }
        );
      }
    });

    return NextResponse.json({ success: true, plan: activatedPlan });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const message = error instanceof Error ? error.message : "";
    if (message.includes("Redeem code") || message.includes("used") || message.includes("usage")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/billing/redeem-code");
  }
}
