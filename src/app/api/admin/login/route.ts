import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION,
  createAdminSessionToken,
  isAdminUser,
  isValidAdminCredentials,
} from "@/lib/admin-auth";
import { handleApiError } from "@/lib/api-error";

type FirebaseSignInResponse = {
  localId: string;
  email: string;
  idToken: string;
};

type FirebaseSignInResult =
  | { ok: true; user: { uid: string; email: string } }
  | { ok: false; error: string };

async function signInWithFirebasePassword(email: string, password: string): Promise<FirebaseSignInResult> {
  const apiKey =
    process.env.FIREBASE_API_KEY || process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error: "Unable to verify admin credentials.",
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
    return {
      ok: false,
      error: "Invalid credentials.",
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

const LOGIN_WINDOW_MS = 60_000;
const LOGIN_MAX_ATTEMPTS = 5;
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(key: string) {
  const now = Date.now();
  const record = loginAttempts.get(key);

  if (!record || record.resetAt <= now) {
    loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  if (record.count >= LOGIN_MAX_ATTEMPTS) {
    return true;
  }

  record.count += 1;
  return false;
}

export async function POST(request: NextRequest) {
  try {
    // Basic origin/referrer check to reduce CSRF risk for this endpoint
    const origin = request.headers.get("origin") || request.headers.get("referer");
    const allowedOrigin = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || null;
    if (allowedOrigin && origin && !origin.startsWith(allowedOrigin)) {
      return NextResponse.json({ error: "Access denied" }, { status: 403 });
    }

    // Rate limit by IP header (best-effort). Use shared store in production.
    const ip =
      request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const { username, password } = await request.json();
    const email = typeof username === "string" ? username.trim().toLowerCase() : "";
    const secret = typeof password === "string" ? password : "";

    if (isValidAdminCredentials(email, secret)) {
      const sessionToken = createAdminSessionToken(email);
      if (!sessionToken) {
        return NextResponse.json(
          {
            error: "Unable to create admin session.",
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
        { error: "Invalid credentials." },
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
          error: "Unable to create admin session.",
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
  } catch (error) {
    return handleApiError(error, "POST /api/admin/login");
  }
}
