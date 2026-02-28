import { NextRequest, NextResponse } from "next/server";
import { adminAuth } from "./admin";

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
    console.error("Auth verification error:", error);
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
}
