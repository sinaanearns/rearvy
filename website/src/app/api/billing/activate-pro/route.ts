import { NextRequest, NextResponse } from "next/server";
import { attachVerifiedProPaymentToUser } from "@/lib/billing/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { DEFAULT_PLAN } from "@/lib/plans";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = (await request.json()) as {
      verificationId?: unknown;
    };

    const verificationId =
      typeof body.verificationId === "string" ? body.verificationId.trim() : "";

    if (!verificationId) {
      return NextResponse.json(
        { error: "Missing payment verification reference." },
        { status: 400 }
      );
    }

    await attachVerifiedProPaymentToUser({
      verificationId,
      userId: data.user.id,
      email: data.user.email,
    });

    const profileRef = adminDb.collection("profiles").doc(data.user.id);
    const profileSnap = await profileRef.get();
    const existingProfile = profileSnap.data() || {};

    await profileRef.set(
      {
        email: data.user.email || existingProfile.email || "",
        full_name: existingProfile.full_name || "",
        avatar_url: existingProfile.avatar_url || null,
        business_name: existingProfile.business_name || null,
        business_type: existingProfile.business_type || null,
        onboarding_completed: existingProfile.onboarding_completed || false,
        timezone: existingProfile.timezone || "UTC",
        currency: existingProfile.currency || "USD",
        plan: "pro",
        created_at: existingProfile.created_at || new Date(),
        updated_at: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({
      success: true,
      plan: "pro",
      previousPlan:
        existingProfile.plan === "pro" ? "pro" : DEFAULT_PLAN,
    });
  } catch (error) {
    console.error("Error activating Pro plan:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to activate the Pro plan.",
      },
      { status: 400 }
    );
  }
}
