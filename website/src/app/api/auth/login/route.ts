import { NextResponse, type NextRequest } from "next/server";
import { adminAuth } from "@/lib/firebase/admin";
import { handleApiError } from "@/lib/api-error";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };

    const email = typeof body.email === "string" ? body.email.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required." },
        { status: 400 }
      );
    }

    // Firebase client-side handles the actual signInWithPassword
    // This endpoint can be used for server-side validation/logging if needed
    // For password validation, use Firebase client SDK on the frontend

    try {
      // Get user to validate email exists (admin SDK)
      const user = await adminAuth.getUserByEmail(email);
      
      // Don't expose whether user exists for security
      return NextResponse.json(
        { ok: true },
        { status: 200 }
      );
    } catch (error: any) {
      if (error.code === "auth/user-not-found") {
        // Don't expose user not found for security reasons
        return NextResponse.json(
          { ok: true },
          { status: 200 }
        );
      }
      throw error;
    }
  } catch (error) {
    return handleApiError(error, "POST /api/auth/login");
  }
}

