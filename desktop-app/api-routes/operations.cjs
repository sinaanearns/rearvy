const { recordOperationEvent } = require("../lib/business-cache.cjs");

const MAX_EVENTS = 120;
const VALID_LEVELS = new Set(["debug", "info", "warn", "error", "system"]);
const VALID_SOURCES = new Set([
  "local-api",
  "event-queue",
  "scheduler",
  "resource-monitor",
  "approval",
  "memory",
]);

let operationEvents = [];
let operationState = {
  running: false,
  startedAt: null,
  lastEventAt: operationEvents[operationEvents.length - 1]?.timestamp || null,
};
const sseClients = new Set();

function cleanText(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function normalizeLevel(level) {
  return VALID_LEVELS.has(level) ? level : "info";
}

function normalizeSource(source) {
  return VALID_SOURCES.has(source) ? source : "local-api";
}

function getResourceUsage() {
  const usage = process.memoryUsage();

  return {
    memoryMb: Math.round((usage.rss / 1024 / 1024) * 10) / 10,
    heapUsedMb: Math.round((usage.heapUsed / 1024 / 1024) * 10) / 10,
    uptimeSec: Math.round(process.uptime()),
  };
}

function buildProfile() {
  return {
    name: "Rearvy Business Ops Runtime",
    mode: "event-driven",
    description:
      "Wakes for user requests, webhooks, schedules, metric changes, anomalies, or explicitly approved automation.",
    skills: [
      "events",
      "integrations",
      "approvals",
      "memory",
      "resource-monitoring",
      "local-cache",
    ],
  };
}

function buildStatus() {
  return {
    available: true,
    running: operationState.running,
    pid: null,
    startedAt: operationState.startedAt,
    lastEventAt: operationState.lastEventAt,
    resource: getResourceUsage(),
    profile: buildProfile(),
    events: operationEvents,
  };
}

function writeSse(res, eventName, data) {
  res.write(`event: ${eventName}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

function broadcastSse(eventName, data) {
  for (const client of sseClients) {
    writeSse(client, eventName, data);
  }
}

function pushOperationEvent(input) {
  const timestamp = new Date().toISOString();
  const event = {
    id: cleanText(input.id, `${Date.now()}-${Math.random().toString(36).slice(2)}`, 160),
    timestamp,
    level: normalizeLevel(input.level),
    source: normalizeSource(input.source),
    message: cleanText(input.message, "Operations runtime event.", 1000),
    payload:
      input.payload && typeof input.payload === "object" && !Array.isArray(input.payload)
        ? input.payload
        : null,
  };

  operationEvents = [...operationEvents, event].slice(-MAX_EVENTS);
  operationState.lastEventAt = timestamp;
  recordOperationEvent(event);
  broadcastSse("operations", event);
  return event;
}

function startOperations(req, res) {
  const chatId = cleanText(req.body?.chatId, "", 160);
  const startedAt = operationState.startedAt || new Date().toISOString();
  operationState = {
    running: true,
    startedAt,
    lastEventAt: operationState.lastEventAt,
  };

  const event = pushOperationEvent({
    level: "system",
    source: "local-api",
    message: chatId
      ? `Operations runtime armed for chat ${chatId}.`
      : "Operations runtime armed.",
    payload: {
      mode: "event-driven",
      wakeTriggers: [
        "user_request",
        "webhook",
        "schedule",
        "anomaly",
        "metric_change",
        "automation_trigger",
      ],
    },
  });

  res.json({
    success: true,
    ok: true,
    running: true,
    event,
    profile: buildProfile(),
    status: buildStatus(),
  });
}

function handleEventCallback(req, res) {
  const event = pushOperationEvent({
    level: req.body?.level,
    source: req.body?.source,
    message: req.body?.message || req.body?.log,
    payload: req.body?.payload,
  });

  res.json({ success: true, event });
}

function openEventStream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  sseClients.add(res);
  writeSse(res, "status", buildStatus());

  const heartbeat = setInterval(() => {
    writeSse(res, "heartbeat", { timestamp: new Date().toISOString() });
  }, 30000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.delete(res);
  });
}

async function operationsHandler(req, res) {
  const path = req.path || "/";

  if (req.method === "GET" && (path === "/" || path === "/status")) {
    return res.json(buildStatus());
  }

  if (req.method === "GET" && path === "/events") {
    return openEventStream(req, res);
  }

  if (req.method === "POST" && path === "/start") {
    return startOperations(req, res);
  }

  if (req.method === "POST" && path === "/") {
    return handleEventCallback(req, res);
  }

  return res.status(404).json({ error: "Operations endpoint not found" });
}

module.exports = operationsHandler;
