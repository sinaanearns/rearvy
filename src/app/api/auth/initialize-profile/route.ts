import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { DEFAULT_PLAN, type SubscriptionPlan } from "@/lib/plans";
import { ensureDefaultUserSystemChats } from "@/lib/chat/system-chats";

export const runtime = "nodejs";

function normalizeUsernameFromName(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return base || "rearvy_user";
}

async function resolveUniqueUsername(base: string, userId: string) {
  let candidate = base;
  let counter = 0;

  while (counter < 25) {
    const existing = await adminDb
      .collection("profiles")
      .where("username_lower", "==", candidate)
      .limit(1)
      .get();

    if (existing.empty || existing.docs[0].id === userId) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}_${counter}`.slice(0, 30);
  }

  return `${base}_${Date.now().toString().slice(-4)}`.slice(0, 30);
}

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
    const baseUsernameSource =
      (typeof existingProfile.username === "string" && existingProfile.username) ||
      fullName ||
      (typeof data.user.email === "string" ? data.user.email.split("@")[0] : "rearvy_user");
    const username = await resolveUniqueUsername(
      normalizeUsernameFromName(baseUsernameSource),
      data.user.id
    );

    await profileRef.set(
      {
        full_name: fullName || existingProfile.full_name || "",
        username,
        username_lower: username.toLowerCase(),
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

    await ensureDefaultUserSystemChats(data.user.id);

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
