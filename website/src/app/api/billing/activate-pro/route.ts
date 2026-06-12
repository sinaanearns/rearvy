import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { attachVerifiedProPaymentToUser } from "@/lib/billing/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";
import { handleApiError } from "@/lib/api-error";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { normalizeProfileAvatarUrl } from "@/lib/profile/profile-normalization";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await readJsonRecord(request);

    const verificationId =
      typeof body.verificationId === "string" ? body.verificationId.trim() : "";

    if (!verificationId) {
      return NextResponse.json(
        { error: "Missing payment verification reference." },
        { status: 400 }
      );
    }

    const activatedPlan = await attachVerifiedProPaymentToUser({
      verificationId,
      userId: data.user.id,
      email: data.user.email,
    });

    const profileRef = adminDb.collection("profiles").doc(data.user.id);
    const profileSnap = await profileRef.get();
    const existingProfile = profileSnap.data() || {};
    const existingFullName = normalizeRearvyDisplayText(existingProfile.full_name) || "";
    const existingBusinessName =
      normalizeRearvyDisplayText(existingProfile.business_name) || null;
    const existingAvatarUrl = normalizeProfileAvatarUrl(existingProfile.avatar_url);

    await profileRef.set(
      {
        email: data.user.email || existingProfile.email || "",
        full_name: existingFullName,
        avatar_url: existingAvatarUrl,
        business_name: existingBusinessName,
        business_type: existingProfile.business_type || null,
        onboarding_completed: existingProfile.onboarding_completed || false,
        timezone: existingProfile.timezone || "UTC",
        currency: existingProfile.currency || "USD",
        plan: activatedPlan,
        created_at: existingProfile.created_at || new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      plan: activatedPlan,
      previousPlan:
        existingProfile.plan === "pro" || existingProfile.plan === "business"
          ? (existingProfile.plan as SubscriptionPlan)
          : DEFAULT_PLAN,
    });
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/billing/activate-pro");
  }
}
