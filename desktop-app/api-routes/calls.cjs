const express = require("express");
const fetch = require("node-fetch");
const router = express.Router();

// Lightweight calls/telephony webhook and control surface.
// This file implements a simple Twilio dialing flow using the REST API.
// Important: Twilio must be able to reach the TwiML callback URL you provide.
// For local development you will need a public tunnel (ngrok) or deploy a public callback endpoint.

function getPublicCallbackBase() {
  // Prefer an explicitly configured public callback URL, then fall back to known envs.
  return (
    process.env.REARVY_PUBLIC_CALLBACK_URL || process.env.REARVY_REMOTE_APP_URL || process.env.REARVY_DESKTOP_APP_URL || null
  );
}

// POST /api/calls/initiate
// Body: { to: string, from?: string, direction?: 'outbound'|'inbound', provider?: 'twilio' }
router.post("/initiate", async (req, res) => {
  const { to, from, direction = "outbound", provider = "twilio" } = req.body || {};

  if (!to) {
    return res.status(400).json({ error: "Missing 'to' parameter" });
  }

  const sessionId = `call_${Date.now()}`;
  console.log(`[Calls] Initiating ${direction} call via ${provider} to ${to} (from ${from || 'default'}) session=${sessionId}`);

  if (provider === "twilio") {
    const SID = process.env.TWILIO_ACCOUNT_SID;
    const AUTH = process.env.TWILIO_AUTH_TOKEN;

    if (!SID || !AUTH) {
      return res.status(500).json({ error: "Twilio credentials not configured (TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN)" });
    }

    const callbackBase = getPublicCallbackBase();
    if (!callbackBase) {
      console.warn("[Calls] No public callback base configured. Twilio needs a public URL to fetch TwiML.");
    }

    const twimlUrl = callbackBase ? `${callbackBase.replace(/\/+$/,'')}/api/calls/twiml/${encodeURIComponent(sessionId)}` : undefined;

    try {
      const form = new URLSearchParams();
      form.append("To", to);
      if (from) form.append("From", from);
      if (twimlUrl) form.append("Url", twimlUrl);

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${SID}/Calls.json`;
      const response = await fetch(twilioUrl, {
        method: "POST",
        headers: {
          Authorization: "Basic " + Buffer.from(`${SID}:${AUTH}`).toString("base64"),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: form.toString(),
      });

      const data = await response.json();
      console.log("[Calls][Twilio] Create call response:", data);

      return res.json({ ok: true, sessionId, provider: "twilio", twilio: data });
    } catch (err) {
      console.error("[Calls][Twilio] failed to create call:", err);
      return res.status(500).json({ error: String(err?.message || err) });
    }
  }

  // Generic fallback: no provider-specific action implemented
  return res.json({ ok: true, sessionId, provider, to, from });
});

// TwiML endpoint that Twilio will request when the call connects.
// For development this returns simple TwiML that says a message and hangs up.
// Replace this with conference or <Start><Stream> wiring for real-time two-way audio.
router.post("/twiml/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  const message = process.env.REARVY_CALL_CONNECT_MESSAGE || "You are being connected to Maria.";

  const twiml = `<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<Response>\n  <Say voice=\"alice\">${message}</Say>\n  <Pause length=\"1\"/>\n  <Hangup/>\n</Response>`;

  res.set("Content-Type", "text/xml");
  res.send(twiml);
});

// POST /api/calls/webhook/twilio
// Twilio will POST call status and event webhooks here. Extend to handle 'start', 'connect', 'media', etc.
router.post("/webhook/twilio", express.urlencoded({ extended: false }), (req, res) => {
  // NOTE: For production, verify Twilio request signatures
  console.log("[Calls][TwilioWebhook] Received webhook:", req.body);

  // Minimal response to acknowledge receipt
  res.status(200).send("OK");
});

// GET /api/calls/status/:id
router.get("/status/:id", (req, res) => {
  const id = req.params.id;
  // TODO: return real session state by mapping Twilio call SID -> session id
  res.json({ id, state: "unknown" });
});

module.exports = router;
