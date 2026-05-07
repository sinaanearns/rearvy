import { NextRequest } from "next/server";
import { adminAuth } from "./admin";

/**
 * Get authenticated user from request headers
 */
export async function getUserFromRequest(request: NextRequest): Promise<{
  data: { user: { id: string; email: string | null; uid: string } | null };
  error?: Error;
}> {
  try {
    const authHeader = request.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return { data: { user: null } };
    }

    const token = authHeader.split("Bearer ")[1];
    const decodedToken = await adminAuth.verifyIdToken(token);

    return {
      data: {
        user: {
          id: decodedToken.uid,
          uid: decodedToken.uid,
          email: decodedToken.email || null,
        },
      },
    };
  } catch (err) {
    return { 
      data: { user: null }, 
      error: err instanceof Error ? err : new Error("Authentication failed") 
    };
  }
}

/**
 * Get user from cookies (for server components)
 */
export async function getUserFromCookies(): Promise<{
  user: { id: string; email: string | null; uid: string } | null;
}> {
  // Firebase client-side auth doesn't use server cookies
  // If needed, implement custom session cookie handling
  return { user: null };
}
