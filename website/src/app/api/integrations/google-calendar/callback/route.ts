import { handleGoogleOAuthCallback } from "@/lib/integrations/google-oauth";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  return handleGoogleOAuthCallback(request);
}
