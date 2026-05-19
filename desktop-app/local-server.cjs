/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const cors = require("cors");

const shopifyHandler = require("./api-routes/auth-shopify.cjs");
const githubHandler = require("./api-routes/auth-github.cjs");
const automatonHandler = require("./api-routes/automaton.cjs");

const DEFAULT_PORT = Number(process.env.REARVY_LOCAL_API_PORT || 4000);
const FALLBACK_REMOTE_BASE_URL = "https://www.rearvy.com";

function getFirstValidUrl(values, fallback) {
  for (const value of values) {
    if (!value) {
      continue;
    }

    try {
      const parsed = new URL(value);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        continue;
      }

      return parsed.toString();
    } catch {
      // Ignore invalid values and continue with next candidate.
    }
  }

  return fallback;
}

function parseOrigin(value) {
  if (!value) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.origin;
  } catch {
    return null;
  }
}

const REMOTE_BASE_URL = getFirstValidUrl(
  [
    process.env.REARVY_REMOTE_APP_URL,
    process.env.REARVY_DESKTOP_APP_URL,
    process.env.REARVY_DESKTOP_DEV_URL,
  ],
  FALLBACK_REMOTE_BASE_URL
);
const REMOTE_BASE_ORIGIN = (() => {
  try {
    return new URL(REMOTE_BASE_URL).origin;
  } catch {
    return null;
  }
})();
const ALLOWED_ORIGINS = (() => {
  const origins = new Set([
    "https://www.rearvy.com",
    "https://rearvy.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4000",
    "http://127.0.0.1:4000",
  ]);

  const configuredOrigins = [
    process.env.REARVY_REMOTE_APP_URL,
    process.env.REARVY_DESKTOP_APP_URL,
    process.env.REARVY_DESKTOP_DEV_URL,
    ...(process.env.REARVY_LOCAL_API_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  ];

  for (const candidate of configuredOrigins) {
    const origin = parseOrigin(candidate);
    if (origin) {
      origins.add(origin);
    }
  }

  return origins;
})();

let server = null;
let serverPort = null;
let startPromise = null;

function shouldAllowOrigin(origin) {
  if (!origin) {
    return false;
  }

  // Reject null origin (file:// context) for security
  if (origin === "null") {
    return false;
  }

  try {
    const parsed = new URL(origin);
    
    // Only allow explicitly configured origins, not entire protocols
    return (
      ALLOWED_ORIGINS.has(parsed.origin) ||
      (REMOTE_BASE_ORIGIN !== null && parsed.origin === REMOTE_BASE_ORIGIN)
    );
  } catch {
    return false;
  }
}

function buildRemoteUrl(req) {
  return new URL(req.originalUrl, REMOTE_BASE_URL).toString();
}

function isHopByHopHeader(name) {
  return [
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailers",
    "transfer-encoding",
    "upgrade",
    "content-length",
  ].includes(name.toLowerCase());
}

async function proxyUnhandled(req, res) {
  const remoteUrl = buildRemoteUrl(req);
  const headers = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (!isHopByHopHeader(key) && typeof value !== "undefined") {
      headers[key] = Array.isArray(value) ? value.join(",") : value;
    }
  }

  if (req.originalUrl.startsWith("/api/")) {
    headers["x-rearvy-desktop"] = "1";
  }

  const hasBody = !["GET", "HEAD"].includes(req.method.toUpperCase());
  const body = hasBody
    ? typeof req.body === "string"
      ? req.body
      : Buffer.isBuffer(req.body)
        ? req.body
        : req.body && Object.keys(req.body).length
          ? JSON.stringify(req.body)
          : undefined
    : undefined;

  const response = await fetch(remoteUrl, {
    method: req.method,
    headers,
    body,
    redirect: "manual",
  });

  res.status(response.status);
  response.headers.forEach((value, key) => {
    if (!isHopByHopHeader(key) && key.toLowerCase() !== "set-cookie") {
      res.setHeader(key, value);
    }
  });

  const arrayBuffer = await response.arrayBuffer();
  res.send(Buffer.from(arrayBuffer));
}

function createLocalApiApp() {
  const app = express();

  app.use(
    cors({
      origin(origin, callback) {
        if (shouldAllowOrigin(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`Origin not allowed: ${origin || "unknown"}`));
        }
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ extended: true }));

  app.use("/api/auth/shopify", shopifyHandler);
  app.use("/api/auth/shopify/callback", shopifyHandler);
  app.use("/api/integrations/github/connect", githubHandler);
  app.use("/api/integrations/github/callback", githubHandler);
  app.use("/api/auth/github", githubHandler);
  app.use("/api/auth/github/callback", githubHandler);
  app.use("/api/internal/automaton", automatonHandler);
  console.log("[LocalServer] All route handlers registered successfully");

  app.use((req, res) => {
    void proxyUnhandled(req, res).catch((error) => {
      console.error("[Rearvy Local API] proxy failure:", error);
      if (!res.headersSent) {
        res.status(502).json({ error: "Local API proxy failed" });
      }
    });
  });

  return app;
}

function listenOnPort(app, port) {
  return new Promise((resolve, reject) => {
    const requestedPort = Number(port) || 0;
    console.log(`[LocalServer] Attempting to listen on 127.0.0.1:${requestedPort || "dynamic"}...`);

    const nextServer = app.listen(requestedPort, "127.0.0.1", () => {
      const address = nextServer.address();
      const resolvedPort = address && typeof address === "object" ? address.port : requestedPort;
      server = nextServer;
      serverPort = resolvedPort;
      console.log(`[LocalServer] Server listening on 127.0.0.1:${serverPort}`);
      resolve({ port: serverPort });
    });

    nextServer.once("error", (error) => {
      console.error("[LocalServer] Server error event:", error);
      reject(error);
    });
  });
}

async function startLocalServer() {
  if (server) {
    return { port: serverPort };
  }

  if (startPromise) {
    return startPromise;
  }

  startPromise = (async () => {
    let app;
    try {
      app = createLocalApiApp();
    } catch (handlerError) {
      console.error("[LocalServer] Failed to register route handlers:", handlerError);
      throw new Error(`Failed to register route handlers: ${handlerError instanceof Error ? handlerError.message : String(handlerError)}`);
    }

    try {
      return await listenOnPort(app, DEFAULT_PORT);
    } catch (error) {
      if (error && error.code === "EADDRINUSE") {
        console.warn(`[LocalServer] Port ${DEFAULT_PORT} is busy; falling back to a dynamic port.`);
        return await listenOnPort(app, 0);
      }

      throw error;
    }
  })().finally(() => {
    startPromise = null;
  });

  return startPromise;
}

function stopLocalServer() {
  if (!server) {
    return;
  }

  server.close();
  server = null;
  serverPort = null;
}

module.exports = {
  startLocalServer,
  stopLocalServer,
};
