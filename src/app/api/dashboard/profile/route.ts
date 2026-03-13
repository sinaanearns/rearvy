import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN } from "@/lib/plans";

export async function GET(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profileDoc = await adminDb
      .collection("profiles")
      .doc(data.user.id)
      .get();

    const profile = profileDoc.exists
      ? {
        plan: DEFAULT_PLAN,
        ...profileDoc.data(),
      }
      : {
        id: data.user.id,
        email: data.user.email,
        full_name: "",
        business_name: "",
        business_type: "",
        plan: DEFAULT_PLAN,
        timezone: "UTC",
        currency: "USD",
        avatar_url: "",
      };

    return NextResponse.json({ profile });
  } catch (error) {
    console.error("Error fetching profile:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { data, error } = await getUserFromRequest(request);
    if (error || !data.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      full_name,
      business_name,
      business_type,
      timezone,
      currency,
      plan,
    } = body;
    const normalizedPlan =
      plan === "free" || plan === "pro" ? plan : undefined;
    const profileRef = adminDb.collection("profiles").doc(data.user.id);
    const existingProfile = await profileRef.get();
    const currentPlan =
      existingProfile.data()?.plan === "pro" ? "pro" : DEFAULT_PLAN;

    if (normalizedPlan === "pro" && currentPlan !== "pro") {
      return NextResponse.json(
        {
          error: "Use the secure billing checkout to upgrade this account to Pro.",
        },
        { status: 402 }
      );
    }

    await profileRef.set(
      {
        full_name: full_name || "",
        business_name: business_name || "",
        business_type: business_type || null,
        timezone: timezone || "UTC",
        currency: currency || "USD",
        ...(normalizedPlan ? { plan: normalizedPlan } : {}),
        updated_at: new Date(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error updating profile:", error);
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }
}
