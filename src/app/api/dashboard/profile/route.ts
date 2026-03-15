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
    } = body;
    const profileRef = adminDb.collection("profiles").doc(data.user.id);

    await profileRef.set(
      {
        full_name: full_name || "",
        business_name: business_name || "",
        business_type: business_type || null,
        timezone: timezone || "UTC",
        currency: currency || "USD",
        plan: DEFAULT_PLAN,
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
