import { NextRequest, NextResponse } from "next/server";
import { adminAuth, adminDb } from "./admin";
import { COLLECTIONS } from "./schema";
import { createServerLogger } from "@/lib/server-logger";
import type { Profile } from "./schema";

const log = createServerLogger("FirebaseAuthMiddleware");

/**
 * Middleware to verify Firebase auth token and get user
 */
export async function requireAuth(request: NextRequest): Promise<
  | { user: { uid: string; email: string | null }; error: null }
  | { user: null; error: NextResponse }
> {
  try {
    const authHeader = request.headers.get("authorization");
    
    if (!authHeader?.startsWith("Bearer ")) {
      return {
        user: null,
        error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      };
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    return {
      user: {
        uid: decodedToken.uid,
        email: decodedToken.email || null,
      },
      error: null,
    };
  } catch (error) {
    log.warn("Auth verification error:", error);
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}

export async function verifyPremiumGating(userId: string): Promise<boolean> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const doc = await adminDb.collection(COLLECTIONS.PROFILES || "profiles").doc(userId).get();
      if (!doc.exists) {
        return false;
      }
      const profile = doc.data() as Profile;
      return profile.plan === "pro" || profile.plan === "business";
    } catch (error) {
      lastError = error;
      log.warn(`Subscription status check failed (attempt ${attempt}/3):`, error);
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
      }
    }
  }
  log.error("Failed to check subscription status after 3 attempts:", lastError);
  return false;
}

