import { NextResponse, type NextRequest } from "next/server";
import { adminDb } from "@/lib/firebase/admin";
import { exchangeStripeCode, persistStripeConnection } from "@/lib/integrations/stripe/client";
import { runStripeSync } from "@/lib/integrations/stripe/sync";
import { createServerLogger } from "@/lib/server-logger";

export const runtime = "nodejs";

const log = createServerLogger("StripeCallbackApi");

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(`/integrations?stripe=error&reason=${oauthError}`);
  }
  if (!code) {
    return NextResponse.redirect("/integrations?stripe=error&reason=missing_code");
  }

  // The `state` here is the user uid passed during connect.
  const userId = state || "";
  if (!userId) {
    return NextResponse.redirect("/integrations?stripe=error&reason=state_missing");
  }

  try {
    const redirectUri = process.env.STRIPE_REDIRECT_URI;
    if (!redirectUri) {
      return NextResponse.redirect("/integrations?stripe=error&reason=config");
    }

    const config = await exchangeStripeCode(code, redirectUri);
    const integrationId = await persistStripeConnection(adminDb, userId, config);

    try {
      const { listStripeInvoices, listStripeCharges, listStripeSubscriptions } =
        await import("@/lib/integrations/stripe/client");
      const [invoices, charges, subscriptions] = await Promise.all([
        listStripeInvoices(config, 10),
        listStripeCharges(config, 10),
        listStripeSubscriptions(config, 10),
      ]);
      await runStripeSync(adminDb, userId, integrationId, config, {
        invoices,
        charges,
        subscriptions,
      });
    } catch (syncErr) {
      log.warn("Stripe sync failed during connect.", syncErr);
    }

    log.info("Stripe connected.", { userId, integrationId });
    return NextResponse.redirect("/integrations?stripe=connected");
  } catch (routeError) {
    log.error("Stripe callback failed.", routeError);
    return NextResponse.redirect(
      `/integrations?stripe=error&reason=${encodeURIComponent(
        routeError instanceof Error ? routeError.message : "unknown",
      )}`,
    );
  }
}
