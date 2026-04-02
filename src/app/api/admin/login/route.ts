import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE_NAME,
  ADMIN_SESSION_DURATION,
  getConfiguredAdminEmails,
  isAdminUser,
  isValidAdminCredentials,
} from "@/lib/admin-auth";

type FirebaseSignInResponse = {
  localId: string;
  email: string;
  idToken: string;
};

async function signInWithFirebasePassword(email: string, password: string) {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      error:
        "Firebase admin sign-in is not configured. Set NEXT_PUBLIC_FIREBASE_API_KEY or ADMIN_EMAILS and ADMIN_PASSWORDS.",
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
      error:
        payload && "error" in payload && payload.error?.message
          ? payload.error.message
          : "Invalid email or password.",
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

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    const email = typeof username === "string" ? username.trim().toLowerCase() : "";
    const secret = typeof password === "string" ? password : "";

    const adminEmails = getConfiguredAdminEmails();
    if (isValidAdminCredentials(email, secret)) {
      const response = NextResponse.json({ success: true });

      response.cookies.set(ADMIN_COOKIE_NAME, email, {
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

    const response = NextResponse.json({ success: true });

    response.cookies.set(ADMIN_COOKIE_NAME, firebaseSignIn.user.email.toLowerCase(), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: ADMIN_SESSION_DURATION,
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
