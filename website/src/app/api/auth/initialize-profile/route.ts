import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { adminDb } from "@/lib/firebase/admin";
import { getUserFromRequest } from "@/lib/firebase/server";
import { DEFAULT_PLAN, FREE_PLAN_CREDITS, type SubscriptionPlan } from "@/lib/plans";
import { handleApiError } from "@/lib/api-error";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
const log = createServerLogger("InitializeProfile");

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
      log.error("Auth failure", {
        authError: error?.message ?? String(error),
        hasAuthHeader: Boolean(request.headers.get("authorization")),
      });

      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await readJsonRecord(request);

    const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
    const avatarUrl = typeof body.avatarUrl === "string" ? body.avatarUrl : "";
    const plan: SubscriptionPlan = DEFAULT_PLAN;

    log.debug("Creating/updating profile", {
      uid: data.user.id,
      hasEmail: Boolean(data.user.email),
      hasFullName: Boolean(fullName),
    });

    try {
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
      const existingPlan =
        existingProfile.plan === "pro" ||
        existingProfile.plan === "business" ||
        existingProfile.plan === DEFAULT_PLAN
          ? (existingProfile.plan as SubscriptionPlan)
          : plan;

      await profileRef.set(
        {
          full_name: fullName || existingProfile.full_name || "",
          username,
          username_lower: username.toLowerCase(),
          email: data.user.email || existingProfile.email || "",
          avatar_url: avatarUrl || existingProfile.avatar_url || null,
          business_name: existingProfile.business_name || null,
          business_type: existingProfile.business_type || null,
          plan: existingPlan,
          credits:
            typeof existingProfile.credits === "number"
              ? existingProfile.credits
              : FREE_PLAN_CREDITS,
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
          plan: existingPlan,
          credits: FREE_PLAN_CREDITS,
        },
      });
    } catch (dbError) {
      log.error("Firestore write failed, returning fallback success:", dbError);
      return NextResponse.json({
        success: true,
        profile: {
          plan: plan,
          credits: FREE_PLAN_CREDITS,
        },
        _fallback: true,
      });
    }
  } catch (error) {
    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return handleApiError(error, "POST /api/auth/initialize-profile");
  }
}
