import { NextResponse, type NextRequest } from "next/server";
import { requireAuth } from "@/lib/firebase/middleware";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("StripeConnectApi");

export async function GET(request: NextRequest) {
  const { user, error } = await requireAuth(request);
  if (error) {
    return error;
  }

  const clientId = process.env.STRIPE_CLIENT_ID;
  const redirectUri = process.env.STRIPE_REDIRECT_URI;

  if (!clientId || !redirectUri) {
    return NextResponse.json(
      { error: "Stripe Connect is not configured on this server." },
      { status: 500 },
    );
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    scope: "read_only",
    redirect_uri: redirectUri,
    state: user.uid,
  });

  const authUrl = `https://connect.stripe.com/oauth/authorize?${params.toString()}`;

  log.info("Redirecting user to Stripe Connect.", { userId: user.uid });
  return NextResponse.redirect(authUrl);
}
