import { NextRequest, NextResponse } from "next/server";
import { getUserFromRequest } from "@/lib/firebase/server";
import { adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN } from "@/lib/plans";

function normalizeUsername(input: string) {
  return input
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, 30);
}

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
      username,
      business_name,
      business_type,
      timezone,
      currency,
    } = body;

    let normalizedUsername = "";
    if (typeof username === "string" && username.trim()) {
      normalizedUsername = normalizeUsername(username.trim());
      if (!normalizedUsername) {
        return NextResponse.json(
          { error: "Username can only contain letters, numbers, and underscores." },
          { status: 400 }
        );
      }

      const existing = await adminDb
        .collection("profiles")
        .where("username_lower", "==", normalizedUsername)
        .limit(1)
        .get();

      if (!existing.empty && existing.docs[0].id !== data.user.id) {
        return NextResponse.json(
          { error: "Username is already taken." },
          { status: 409 }
        );
      }
    }

    const profileRef = adminDb.collection("profiles").doc(data.user.id);

    await profileRef.set(
      {
        full_name: full_name || "",
        username: normalizedUsername || null,
        username_lower: normalizedUsername || null,
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
