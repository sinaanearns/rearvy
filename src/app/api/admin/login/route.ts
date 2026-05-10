import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION,
  createAdminSessionToken,
  isAdminUser,
  isValidAdminCredentials,
} from "@/lib/admin-auth";
import { RateLimiterMemory } from "rate-limiter-flexible";

type FirebaseSignInResponse = {
  localId: string;
  email: string;
  idToken: string;
};

async function signInWithFirebasePassword(email: string, password: string) {
  const apiKey =
    process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Firebase admin sign-in is not configured. Set FIREBASE_API_KEY (preferred) or NEXT_PUBLIC_FIREBASE_API_KEY, or use ADMIN_EMAILS and ADMIN_PASSWORDS.",
    };
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        password,
        returnSecureToken: true,
      }),
    }
  );

  const payload = (await response.json().catch(() => null)) as
    | FirebaseSignInResponse
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    const firebaseError =
      payload && "error" in payload && payload.error?.message
        ? payload.error.message
        : null;

    if (firebaseError === "API_KEY_HTTP_REFERRER_BLOCKED") {
      return {
        ok: false,
        error:
          "Firebase API key is restricted by HTTP referrer. Use an unrestricted FIREBASE_API_KEY for server routes or relax key restrictions for identitytoolkit.googleapis.com.",
      };
    }

    return {
      ok: false,
      error:
        firebaseError || "Invalid email or password.",
    };
  }

  if (!payload || !("localId" in payload) || !("email" in payload)) {
    return {
      ok: false,
      error: "Unable to verify admin credentials.",
    };
  }

  return {
    ok: true,
    user: {
      uid: payload.localId,
      email: payload.email,
    },
  };
}

// Simple in-memory rate limiter for login attempts. Replace with
// RateLimiterRedis in production to ensure cross-instance limits.
const loginLimiter = new RateLimiterMemory({ points: 5, duration: 60 }); // 5 attempts per minute per key

export async function POST(request: NextRequest) {
  try {
    // Basic origin/referrer check to reduce CSRF risk for this endpoint
    const origin = request.headers.get("origin") || request.headers.get("referer");
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null;
    if (allowedOrigin && origin && !origin.startsWith(allowedOrigin)) {
      return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
    }

    // Rate limit by IP header (best-effort). Use shared store in production.
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    try {
      await loginLimiter.consume(ip);
    } catch (rlRes) {
      return NextResponse.json({ error: "Too many login attempts" }, { status: 429 });
    }

    const { username, password } = await request.json();
    const email = typeof username === "string" ? username.trim().toLowerCase() : "";
    const secret = typeof password === "string" ? password : "";

    if (isValidAdminCredentials(email, secret)) {
      const sessionToken = createAdminSessionToken(email);
      if (!sessionToken) {
        return NextResponse.json(
          {
            error:
              "Admin session secret is not configured. Set ADMIN_SESSION_SECRET.",
          },
          { status: 500 }
        );
      }

      const response = NextResponse.json({ success: true });

      response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: ADMIN_SESSION_DURATION,
        path: "/",
      });

      return response;
    }

    const firebaseSignIn = await signInWithFirebasePassword(email, secret);
    if (!firebaseSignIn.ok || !firebaseSignIn.user) {
      return NextResponse.json(
        { error: firebaseSignIn.error },
        { status: 401 }
      );
    }

    const adminUser = await isAdminUser({
      id: firebaseSignIn.user.uid,
      uid: firebaseSignIn.user.uid,
      email: firebaseSignIn.user.email,
    });
    if (!adminUser) {
      return NextResponse.json(
        { error: "This account does not have admin access." },
        { status: 403 }
      );
    }

    const sessionToken = createAdminSessionToken(firebaseSignIn.user.email);
    if (!sessionToken) {
      return NextResponse.json(
        {
          error:
            "Admin session secret is not configured. Set ADMIN_SESSION_SECRET.",
        },
        { status: 500 }
      );
    }

    const response = NextResponse.json({ success: true });

    response.cookies.set(ADMIN_COOKIE_NAME, sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_SESSION_DURATION,
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
