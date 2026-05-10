/* eslint-disable @typescript-eslint/no-require-imports */
const express = require("express");
const cors = require("cors");

const shopifyHandler = require("./api-routes/auth-shopify.cjs");
const githubHandler = require("./api-routes/auth-github.cjs");

const DEFAULT_PORT = Number(process.env.REARVY_LOCAL_API_PORT || 4000);
const REMOTE_BASE_URL = process.env.REARVY_REMOTE_APP_URL || "https://www.rearvy.com";

let server = null;
let serverPort = null;
let startPromise = null;

function shouldAllowOrigin(origin) {
  if (!origin) {
    return true;
  }

  if (origin === "null") {
    return true;
  }

  try {
    const parsed = new URL(origin);
    if (parsed.protocol === "rearvy:") {
      return true;
    }

    return (
      parsed.origin === "http://localhost:3000" ||
      parsed.origin === "http://127.0.0.1:3000" ||
      parsed.origin === "http://localhost:4000" ||
      parsed.origin === "http://127.0.0.1:4000"
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

async function startLocalServer() {
  if (server) {
    return { port: serverPort };
  }

  if (startPromise) {
    return startPromise;
  }

  startPromise = new Promise((resolve, reject) => {
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

    app.use((req, res) => {
      void proxyUnhandled(req, res).catch((error) => {
        console.error("[Rearvy Local API] proxy failure:", error);
        if (!res.headersSent) {
          res.status(502).json({ error: "Local API proxy failed" });
        }
      });
    });

    server = app.listen(DEFAULT_PORT, "127.0.0.1", () => {
      serverPort = DEFAULT_PORT;
      resolve({ port: serverPort });
    });

    server.on("error", (error) => {
      reject(error);
    });
  }).finally(() => {
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