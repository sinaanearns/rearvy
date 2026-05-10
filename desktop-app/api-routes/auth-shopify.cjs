/* eslint-disable @typescript-eslint/no-require-imports */
const { getAdminDb, normalizeShopifyDomain, isRecentShopifyTimestamp, verifyShopifyOAuthHmac, encrypt, parseCookies, getLocalServerOrigin, getDesktopUiOrigin } = require("./_shared.cjs");

const STATE_COOKIE = "shopify_saas_state";
const UID_COOKIE = "shopify_saas_uid";
const SHOP_COOKIE = "rearvy_shopify_shop";

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function redirectToDashboard(res, request, shopDomain, error) {
  const target = new URL("/chat", getDesktopUiOrigin());
  target.searchParams.set("shop", shopDomain);
  if (error) {
    target.searchParams.set("error", error);
  }

  res.cookie(SHOP_COOKIE, shopDomain, {
    httpOnly: true,
    secure: false,
    sameSite: "lax",
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });

  res.clearCookie(STATE_COOKIE, { path: "/" });
  res.clearCookie(UID_COOKIE, { path: "/" });
  res.clearCookie("shopify_oauth_state", { path: "/" });
  res.clearCookie("shopify_oauth_uid", { path: "/" });

  res.redirect(302, target.toString());
}

async function handleStart(req, res) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  if (!apiKey) {
    return sendJson(res, 500, { error: "Shopify integration not configured. Set SHOPIFY_API_KEY." });
  }

  const rawShop = String(req.query.shop || "");
  const uid = String(req.query.uid || "");

  if (!rawShop) {
    return sendJson(res, 400, { error: "Missing shop parameter. Usage: ?shop=STORE.myshopify.com" });
  }

  const shopDomain = normalizeShopifyDomain(rawShop);
  if (!shopDomain) {
    return sendJson(res, 400, { error: "Invalid Shopify domain. Must be STORE.myshopify.com" });
  }

  const scopes = process.env.SHOPIFY_SCOPES || "read_products,read_orders,read_inventory";
  const state = require("crypto").randomBytes(16).toString("hex");
  const redirectUri = `${getLocalServerOrigin(req)}/api/auth/shopify/callback`;

  const installUrl = `https://${shopDomain}/admin/oauth/authorize?client_id=${apiKey}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  res.cookie(STATE_COOKIE, state, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 600000 });
  res.cookie(UID_COOKIE, uid, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 600000 });
  res.cookie("shopify_oauth_state", state, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 600000 });
  res.cookie("shopify_oauth_uid", uid, { httpOnly: true, secure: false, sameSite: "lax", path: "/", maxAge: 600000 });

  return res.redirect(302, installUrl);
}

async function handleCallback(req, res) {
  const apiKey = process.env.SHOPIFY_API_KEY;
  const apiSecret = process.env.SHOPIFY_API_SECRET;

  if (!apiKey || !apiSecret) {
    return redirectToDashboard(res, req, "unknown.myshopify.com", "shopify_not_configured");
  }

  const searchParams = new URL(`${req.protocol}://${req.get("host")}${req.originalUrl}`).searchParams;
  const code = searchParams.get("code");
  const rawShop = searchParams.get("shop");
  const state = searchParams.get("state");
  const timestamp = searchParams.get("timestamp");
  const shopDomain = rawShop ? normalizeShopifyDomain(rawShop) : null;

  if (!code || !shopDomain) {
    return redirectToDashboard(res, req, shopDomain || "unknown.myshopify.com", "missing_params");
  }

  const cookies = parseCookies(req.headers.cookie);
  const cookieState = cookies[STATE_COOKIE] || cookies.shopify_oauth_state;
  if (!state || !cookieState || state !== cookieState) {
    return redirectToDashboard(res, req, shopDomain, "invalid_state");
  }

  if (!isRecentShopifyTimestamp(timestamp)) {
    return redirectToDashboard(res, req, shopDomain, "expired_oauth_request");
  }

  if (!verifyShopifyOAuthHmac(searchParams, apiSecret)) {
    return redirectToDashboard(res, req, shopDomain, "invalid_hmac");
  }

  try {
    const tokenRes = await fetch(`https://${shopDomain}/admin/oauth/access_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ client_id: apiKey, client_secret: apiSecret, code }),
    });

    if (!tokenRes.ok) {
      return redirectToDashboard(res, req, shopDomain, "token_exchange_failed");
    }

    const tokenData = await tokenRes.json();
    const accessToken = String(tokenData.access_token || "");
    const scopes = String(tokenData.scope || "").split(",").map((value) => value.trim()).filter(Boolean);

    if (!accessToken) {
      return redirectToDashboard(res, req, shopDomain, "missing_access_token");
    }

    const shopInfoRes = await fetch(`https://${shopDomain}/admin/api/2024-10/shop.json`, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });

    if (!shopInfoRes.ok) {
      return redirectToDashboard(res, req, shopDomain, "shop_fetch_failed");
    }

    const shopInfo = (await shopInfoRes.json()).shop;
    const canonicalDomain = normalizeShopifyDomain(shopInfo.myshopify_domain);
    if (!canonicalDomain) {
      return redirectToDashboard(res, req, shopDomain, "shop_domain_mismatch");
    }

    const { encrypted, iv } = encrypt(accessToken);
    const userId = cookies[UID_COOKIE] || cookies.shopify_oauth_uid || null;
    const integrationData = {
      provider: "shopify",
      provider_account_id: String(shopInfo.id),
      provider_account_name: `${shopInfo.name} (${canonicalDomain})`,
      access_token_enc: encrypted,
      token_iv: iv,
      scopes,
      status: "active",
      sync_cursor: { shop_domain: canonicalDomain },
      updated_at: new Date(),
    };

    if (userId) {
      const adminDb = getAdminDb();
      const integrationRef = adminDb.collection("integrations");
      const existing = await integrationRef.where("user_id", "==", userId).where("provider", "==", "shopify").limit(1).get();

      if (existing.empty) {
        await integrationRef.add({ ...integrationData, user_id: userId, created_at: new Date() });
      } else {
        await integrationRef.doc(existing.docs[0].id).set({ ...integrationData, user_id: userId }, { merge: true });
      }

      return redirectToDashboard(res, req, canonicalDomain);
    }

    await getAdminDb().collection("integrations").doc(`pending_${canonicalDomain}`).set(
      {
        ...integrationData,
        user_id: null,
        status: "pending_claim",
        created_at: new Date(),
      },
      { merge: true }
    );

    const loginUrl = new URL("/login", getDesktopUiOrigin());
    loginUrl.searchParams.set("claim_shop", canonicalDomain);
    return res.redirect(302, loginUrl.toString());
  } catch (error) {
    console.error("[Shopify Callback] Unhandled error:", error);
    return redirectToDashboard(res, req, "unknown.myshopify.com", "oauth_failed");
  }
}

module.exports = async function authShopifyHandler(req, res) {
  const routePath = (req.originalUrl || req.url || req.path).split("?")[0];

  if (routePath.endsWith("/callback")) {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    return handleCallback(req, res);
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  return handleStart(req, res);
};