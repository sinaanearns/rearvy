/* eslint-disable @typescript-eslint/no-require-imports */
const { randomBytes } = require("crypto");
const { getAdminAuth, getAdminDb, parseCookies, getLocalServerOrigin, getDesktopUiOrigin, setOAuthCookies, clearOAuthCookies, encrypt } = require("./_shared.cjs");

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function redirectToIntegrations(res, query) {
  const target = new URL(`/integrations?${query}`, getDesktopUiOrigin());
  res.redirect(302, target.toString());
}

async function handleConnect(req, res) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) {
    return sendJson(res, 401, { error: "Unauthorized" });
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return sendJson(res, 503, { error: "GitHub integration is not configured on this server." });
  }

  try {
    const token = authHeader.slice("Bearer ".length);
    const decoded = await getAdminAuth().verifyIdToken(token);
    const state = randomBytes(16).toString("hex");
    const redirectUri = `${getLocalServerOrigin(req)}/api/integrations/github/callback`;
    const scopes = ["read:user", "user:email", "read:org", "repo"].join(" ");

    const authUrl = new URL("https://github.com/login/oauth/authorize");
    authUrl.searchParams.set("client_id", clientId);
    authUrl.searchParams.set("redirect_uri", redirectUri);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("scope", scopes);
    authUrl.searchParams.set("state", state);

    const payload = { url: authUrl.toString() };
    setOAuthCookies(res, "github_oauth", state, decoded.uid);
    return sendJson(res, 200, payload);
  } catch (error) {
    console.error("[GitHub connect] error:", error);
    return sendJson(res, 500, { error: error instanceof Error ? error.message : "Internal server error" });
  }
}

async function exchangeGitHubCode(code, redirectUri) {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Missing GitHub OAuth credentials");
  }

  const res = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri }),
  });

  if (!res.ok) {
    throw new Error(`GitHub token exchange failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(data.error_description || data.error || "GitHub token exchange failed");
  }

  return { accessToken: data.access_token };
}

async function getGitHubUserProfile(accessToken) {
  const res = await fetch("https://api.github.com/user", {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${accessToken}`,
      "User-Agent": "Rearvy",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!res.ok) {
    throw new Error(`GitHub API error (${res.status})`);
  }

  return await res.json();
}

async function handleCallback(req, res) {
  const { code, state, error } = req.query;
  if (error) {
    return redirectToIntegrations(res, `error=${encodeURIComponent(String(error))}`);
  }

  if (!code) {
    return redirectToIntegrations(res, "error=missing_code");
  }

  const cookies = parseCookies(req.headers.cookie);
  if (!state || state !== cookies.github_oauth_state) {
    return redirectToIntegrations(res, "error=invalid_state");
  }

  const userId = cookies.github_oauth_uid;
  if (!userId) {
    return redirectToIntegrations(res, "error=missing_oauth_session");
  }

  try {
    const redirectUri = `${getLocalServerOrigin(req)}/api/integrations/github/callback`;
    const { accessToken } = await exchangeGitHubCode(String(code), redirectUri);
    const profile = await getGitHubUserProfile(accessToken);
    const { encrypted: accessTokenEnc, iv: accessIv } = encrypt(accessToken);
    const adminDb = getAdminDb();

    const existingSnapshot = await adminDb.collection("integrations").where("user_id", "==", userId).where("provider", "==", "github").get();
    const integrationData = {
      user_id: userId,
      provider: "github",
      provider_account_id: String(profile.id),
      provider_account_name: profile.name || profile.login,
      access_token_enc: accessTokenEnc,
      token_iv: accessIv,
      scopes: ["read:user", "user:email", "read:org", "repo"],
      token_expires_at: null,
      status: "active",
      sync_cursor: { repo_limit: 40 },
      updated_at: new Date().toISOString(),
    };

    if (!existingSnapshot.empty) {
      const existingDoc = existingSnapshot.docs[0];
      await existingDoc.ref.set(integrationData, { merge: true });
    } else {
      await adminDb.collection("integrations").add({ ...integrationData, created_at: new Date().toISOString() });
    }

    clearOAuthCookies(res, "github_oauth");
    return redirectToIntegrations(res, "success=github_connected");
  } catch (error) {
    console.error("[GitHub OAuth] error:", error);
    clearOAuthCookies(res, "github_oauth");
    return redirectToIntegrations(res, `error=${encodeURIComponent(error instanceof Error ? error.message : "github_oauth_failed")}`);
  }
}

module.exports = async function authGitHubHandler(req, res) {
  const routePath = (req.originalUrl || req.url || req.path).split("?")[0];

  if (routePath.endsWith("/callback")) {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    return handleCallback(req, res);
  }

  if (routePath.endsWith("/connect") || routePath.endsWith("/github")) {
    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    return handleConnect(req, res);
  }

  return sendJson(res, 404, { error: "Not found" });
};