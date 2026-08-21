import { NextRequest, NextResponse } from "next/server";
import { isRequestBodyError, readJsonRecord } from "@/lib/api/request-body";
import { normalizeRearvyDisplayText } from "@/lib/brand-display";
import { adminAuth, adminDb } from "@/lib/firebase/admin";
import { DEFAULT_PLAN, FREE_PLAN_CREDITS, type SubscriptionPlan } from "@/lib/plans";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";
const log = createServerLogger("BusinessSignupRoute");

function normalizeUsernameFromName(input: string) {
  const base = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 24);

  return base || "rearvy_user";
}

async function resolveUniqueUsername(base: string) {
  let candidate = base;
  let counter = 0;

  while (counter < 25) {
    const existing = await adminDb
      .collection("profiles")
      .where("username_lower", "==", candidate)
      .limit(1)
      .get();

    if (existing.empty) {
      return candidate;
    }

    counter += 1;
    candidate = `${base}_${counter}`.slice(0, 30);
  }

  return `${base}_${Date.now().toString().slice(-4)}`.slice(0, 30);
}

function getErrorCode(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String((error as { code?: unknown }).code);
  }

  return "";
}

function getSignupError(error: unknown) {
  const code = getErrorCode(error);

  if (code === "auth/email-already-exists") {
    return {
      status: 409,
      publicMessage: "An account with this email already exists. Sign in instead.",
    };
  }

  if (code === "auth/invalid-email") {
    return {
      status: 400,
      message: "Enter a valid email address.",
    };
  }

  if (code === "auth/invalid-password" || code === "auth/weak-password") {
    return {
      status: 400,
      publicMessage: "Password must be at least 6 characters.",
    };
  }

  return {
    status: 500,
    publicMessage: "Unable to create the account.",
  };
}

export async function POST(request: NextRequest) {
  let createdUserId: string | null = null;

  try {
    const body = await readJsonRecord(request);

    const fullName = normalizeRearvyDisplayText(body.fullName) || "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const businessName =
      typeof body.businessName === "string" ? body.businessName.trim() : "";
    const plan: SubscriptionPlan = DEFAULT_PLAN;

    if (!fullName) {
      return NextResponse.json(
        { error: "Full name is required." },
        { status: 400 }
      );
    }

    if (!email) {
      return NextResponse.json(
        { error: "Email is required." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    if (!businessName || businessName.length < 2) {
      return NextResponse.json(
        { error: "Business name is required." },
        { status: 400 }
      );
    }

    const user = await adminAuth.createUser({
      email,
      password,
      displayName: fullName,
    });

    createdUserId = user.uid;
    const username = await resolveUniqueUsername(normalizeUsernameFromName(fullName));

    // Store under the shared profiles collection, flagged as a business account
    await adminDb.collection("profiles").doc(user.uid).set({
      full_name: fullName,
      username,
      username_lower: username.toLowerCase(),
      email: user.email || email,
      avatar_url: null,
      business_name: businessName,
      business_type: "other",
      plan,
      credits: FREE_PLAN_CREDITS,
      onboarding_completed: false,
      timezone: "UTC",
      currency: "USD",
      // Account flags
      account_kind: "business",
      signed_user: true,
      business_onboarding_status: "pending",
      created_at: new Date(),
      updated_at: new Date(),
    });

    return NextResponse.json({
      success: true,
      uid: user.uid,
      account_kind: "business",
    });
  } catch (error) {
    if (createdUserId) {
      await Promise.allSettled([
        adminDb.collection("profiles").doc(createdUserId).delete(),
        adminAuth.deleteUser(createdUserId),
      ]);
    }

    if (isRequestBodyError(error)) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    log.error("Business signup API error:", error);

    const signupError = getSignupError(error);
    return NextResponse.json(
      { error: signupError.publicMessage },
      { status: signupError.status }
    );
  }
}
