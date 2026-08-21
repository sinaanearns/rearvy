import { NextResponse } from "next/server";

export async function GET() {
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_REGULAR_PRODUCT_ID;
  const environment = process.env.DODO_PAYMENTS_ENVIRONMENT || "live_mode";
  const returnUrl = process.env.DODO_PAYMENTS_RETURN_URL;

  const configured =
    Boolean(apiKey && apiKey.trim()) &&
    Boolean(productId && productId.trim());

  // Do not leak secrets; only report booleans and safe strings.
  return NextResponse.json({
    configured,
    environment,
    hasReturnUrl: Boolean(returnUrl && returnUrl.trim()),
    // If not configured, the UI will simply hide the subscribe button.
  });
}