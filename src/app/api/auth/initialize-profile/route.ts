import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      fullName?: unknown;
      avatarUrl?: unknown;
    };

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : "";
    const plan: SubscriptionPlan = DEFAULT_PLAN;

    const profileRef = adminDb.collection("profiles").doc(data.user.id);
    const profileSnap = await profileRef.get();
    const existingProfile = profileSnap.data() || {};

    await profileRef.set(
      {
        full_name: fullName || existingProfile.full_name || "",
        email: data.user.email || existingProfile.email || "",
        avatar_url: avatarUrl || existingProfile.avatar_url || null,
        business_name: existingProfile.business_name || null,
        business_type: existingProfile.business_type || null,
        plan: plan,
        onboarding_completed: existingProfile.onboarding_completed || false,
        timezone: existingProfile.timezone || "UTC",
        currency: existingProfile.currency || "USD",
        created_at: existingProfile.created_at || new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      profile: {
        plan: plan,
      },
    });
  } catch (error) {
    console.error("Initialize profile API error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to finish setting up the account.",
      },
      { status: 400 }
    );
  }
}
