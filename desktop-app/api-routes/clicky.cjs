/* Minimal clicky transcription proxy to AssemblyAI */
const express = require("express");
const router = express.Router();

const ASSEMBLY_KEY = process.env.ASSEMBLYAI_API_KEY;
const TRANSCRIPTION_POLL_ATTEMPTS = 30;
const TRANSCRIPTION_POLL_DELAY_MS = 1000;
const DEFAULT_SPEECH_MODELS = ["universal-3-pro", "universal-2"];
const VOICE_AGENT_TOKEN_URL = "https://agents.assemblyai.com/v1/token";
const DEFAULT_VOICE_AGENT_TOKEN_SECONDS = 300;
const DEFAULT_VOICE_AGENT_MAX_SESSION_SECONDS = 900;
const SPEECH_MODELS = resolveSpeechModels();

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pickString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function clampInteger(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function resolveSpeechModels() {
  const configured = pickString(process.env.ASSEMBLYAI_SPEECH_MODELS)
    .split(",")
    .map((model) => model.trim())
    .filter(Boolean);

  return configured.length > 0 ? configured : DEFAULT_SPEECH_MODELS;
}

function sanitizeAssemblyDetail(value) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 500);
  }

  if (typeof value !== "object") {
    return String(value).slice(0, 500);
  }

  const source = value;
  const detail = {};
  for (const key of ["error", "message", "detail", "status", "status_code"]) {
    if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) {
      detail[key] = typeof source[key] === "string" ? source[key].slice(0, 500) : source[key];
    }
  }

  return Object.keys(detail).length > 0 ? detail : null;
}

function buildSafeMetadata({ requestId, contentType, durationMs, audioBytes }) {
  return {
    requestId: pickString(requestId, "unknown"),
    contentType: pickString(contentType, "unknown"),
    durationMs: Number.isFinite(durationMs) ? Math.max(0, Math.round(durationMs)) : null,
    audioBytes: Number.isFinite(audioBytes) ? Math.max(0, Math.round(audioBytes)) : 0,
  };
}

function normalizeKeyterms(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((item) => typeof item === "string")
        .map((item) => item.trim().replace(/\s+/g, " "))
        .filter((item) => item && item.length <= 80 && item.split(/\s+/).length <= 6)
    )
  ).slice(0, 200);
}

function logTranscription(level, message, metadata, extra = {}) {
  const logger = console[level] || console.log;
  logger(`[Clicky API] ${message}`, {
    ...metadata,
    ...extra,
  });
}

function sendError(res, httpStatus, code, error, metadata, extra = {}) {
  logTranscription(httpStatus >= 500 ? "warn" : "log", `transcription failed: ${code}`, metadata, {
    status: httpStatus,
    detail: extra.detail || null,
  });

  return res.status(httpStatus).json({
    error,
    code,
    status: extra.status,
    detail: extra.detail || null,
    requestId: metadata.requestId,
  });
}

async function readAssemblyResponse(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function extractUploadUrl(payload) {
  if (typeof payload === "string" && payload.trim().startsWith("http")) {
    return payload.trim();
  }

  if (!payload || typeof payload !== "object") {
    return "";
  }

  return pickString(payload.upload_url || payload.url || payload.uploadUrl);
}

async function fetchVoiceAgentToken(url) {
  const rawResponse = await fetch(url, {
    headers: {
      Authorization: ASSEMBLY_KEY,
    },
  });

  // AssemblyAI examples currently show both raw and Bearer auth for token minting.
  // Retry once with Bearer only for auth failures so local dev is resilient.
  if (rawResponse.status !== 401 && rawResponse.status !== 403) {
    return rawResponse;
  }

  return await fetch(url, {
    headers: {
      Authorization: `Bearer ${ASSEMBLY_KEY}`,
    },
  });
}

router.get("/voice-agent-token", async (req, res) => {
  const requestId = pickString(req.query?.requestId, "voice-agent-token");
  const expiresInSeconds = clampInteger(
    process.env.ASSEMBLYAI_VOICE_AGENT_TOKEN_SECONDS,
    DEFAULT_VOICE_AGENT_TOKEN_SECONDS,
    1,
    600
  );
  const maxSessionDurationSeconds = clampInteger(
    process.env.ASSEMBLYAI_VOICE_AGENT_MAX_SESSION_SECONDS,
    DEFAULT_VOICE_AGENT_MAX_SESSION_SECONDS,
    60,
    10800
  );

  const metadata = {
    requestId,
    expiresInSeconds,
    maxSessionDurationSeconds,
  };

  if (!ASSEMBLY_KEY) {
    console.warn("[Clicky API] voice agent token unavailable: missing AssemblyAI key", metadata);
    return res.status(501).json({
      ok: false,
      error: "AssemblyAI API key not configured on desktop local server",
      code: "assemblyai_key_missing",
      requestId,
    });
  }

  try {
    const url = new URL(VOICE_AGENT_TOKEN_URL);
    url.searchParams.set("expires_in_seconds", String(expiresInSeconds));
    url.searchParams.set("max_session_duration_seconds", String(maxSessionDurationSeconds));

    console.log("[Clicky API] minting AssemblyAI voice agent token", metadata);

    const tokenResponse = await fetchVoiceAgentToken(url);
    const payload = await readAssemblyResponse(tokenResponse);
    const detail = sanitizeAssemblyDetail(payload);

    if (!tokenResponse.ok) {
      console.warn("[Clicky API] voice agent token request failed", {
        ...metadata,
        status: tokenResponse.status,
        detail,
      });
      return res.status(502).json({
        ok: false,
        error: "AssemblyAI Voice Agent token request failed",
        code: "assemblyai_voice_agent_token_failed",
        status: tokenResponse.status,
        detail,
        requestId,
      });
    }

    const token = pickString(payload?.token || payload?.temporary_token || payload?.temporaryToken);
    if (!token) {
      console.warn("[Clicky API] voice agent token response did not include a token", {
        ...metadata,
        status: tokenResponse.status,
        detail,
      });
      return res.status(502).json({
        ok: false,
        error: "AssemblyAI Voice Agent token response was invalid",
        code: "assemblyai_voice_agent_token_missing",
        status: tokenResponse.status,
        detail,
        requestId,
      });
    }

    return res.json({
      ok: true,
      token,
      expiresInSeconds,
      maxSessionDurationSeconds,
      requestId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn("[Clicky API] voice agent token network error", {
      ...metadata,
      detail: message.slice(0, 500),
    });
    return res.status(502).json({
      ok: false,
      error: "AssemblyAI Voice Agent token request failed",
      code: "assemblyai_network_error",
      detail: message.slice(0, 500),
      requestId,
    });
  }
});

router.post("/transcribe", async (req, res) => {
  const body = req.body || {};
  const requestId = pickString(body.requestId, "unknown");
  const contentType = pickString(body.contentType || body.metadata?.mimeType, "unknown");
  const durationMs = Number(body.metadata?.durationMs);
  const baseMetadata = buildSafeMetadata({
    requestId,
    contentType,
    durationMs,
    audioBytes: 0,
  });
  let activeMetadata = baseMetadata;

  if (!ASSEMBLY_KEY) {
    return sendError(
      res,
      501,
      "assemblyai_key_missing",
      "AssemblyAI API key not configured on desktop local server",
      baseMetadata
    );
  }

  try {
    const { audio } = body;
    if (!audio) {
      return sendError(res, 400, "audio_missing", "Missing audio payload", baseMetadata);
    }

    const buffer = Buffer.from(audio, "base64");
    const metadata = buildSafeMetadata({
      requestId,
      contentType,
      durationMs,
      audioBytes: buffer.length,
    });
    activeMetadata = metadata;

    if (!buffer.length) {
      return sendError(res, 400, "audio_empty", "Missing audio payload", metadata);
    }

    logTranscription("log", "uploading audio to AssemblyAI", metadata);

    // Upload binary to AssemblyAI
    const uploadRes = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: {
        authorization: ASSEMBLY_KEY,
        "content-type": "application/octet-stream",
      },
      body: buffer,
    });

    const uploadJson = await readAssemblyResponse(uploadRes);
    const uploadDetail = sanitizeAssemblyDetail(uploadJson);
    if (!uploadRes.ok) {
      return sendError(
        res,
        502,
        "assemblyai_upload_failed",
        "AssemblyAI upload failed",
        metadata,
        { status: uploadRes.status, detail: uploadDetail }
      );
    }

    const uploadUrl = extractUploadUrl(uploadJson);
    if (!uploadUrl) {
      return sendError(
        res,
        502,
        "assemblyai_upload_failed",
        "AssemblyAI upload did not return an upload URL",
        metadata,
        { status: uploadRes.status, detail: uploadDetail }
      );
    }

    const keyterms = normalizeKeyterms(body.keyterms || body.metadata?.keyterms);
    const transcriptPayload = {
      audio_url: uploadUrl,
      speech_models: SPEECH_MODELS,
    };

    if (keyterms.length > 0) {
      transcriptPayload.keyterms_prompt = keyterms;
    }

    // Create transcription job
    const createRes = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: ASSEMBLY_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify(transcriptPayload),
    });

    const createJson = await readAssemblyResponse(createRes);
    const createDetail = sanitizeAssemblyDetail(createJson);
    if (!createRes.ok) {
      return sendError(
        res,
        502,
        "assemblyai_transcript_create_failed",
        "Failed to create transcript",
        metadata,
        { status: createRes.status, detail: createDetail }
      );
    }

    const id = createJson && createJson.id;
    if (!id) {
      return sendError(
        res,
        502,
        "assemblyai_transcript_create_failed",
        "Failed to create transcript",
        metadata,
        { status: createRes.status, detail: createDetail }
      );
    }

    // Poll for completion
    let attempt = 0;
    while (attempt < TRANSCRIPTION_POLL_ATTEMPTS) {
      await wait(TRANSCRIPTION_POLL_DELAY_MS);
      const checkRes = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: ASSEMBLY_KEY },
      });

      const checkJson = await readAssemblyResponse(checkRes);
      const checkDetail = sanitizeAssemblyDetail(checkJson);
      if (!checkRes.ok) {
        return sendError(
          res,
          502,
          "assemblyai_transcript_check_failed",
          "Failed to check transcript status",
          metadata,
          { status: checkRes.status, detail: checkDetail }
        );
      }

      if (checkJson.status === "completed") {
        logTranscription("log", "transcription completed", metadata);
        return res.json({
          text: checkJson.text,
          code: "ok",
          requestId: metadata.requestId,
          metadata,
        });
      }

      if (checkJson.status === "failed" || checkJson.status === "error") {
        return sendError(
          res,
          502,
          "assemblyai_transcription_failed",
          "Transcription failed",
          metadata,
          { status: checkRes.status, detail: checkDetail }
        );
      }

      attempt++;
    }

    return sendError(res, 504, "assemblyai_timeout", "Transcription timed out", activeMetadata);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const code = err instanceof TypeError ? "assemblyai_network_error" : "voice_transcription_error";
    return sendError(
      res,
      code === "assemblyai_network_error" ? 502 : 500,
      code,
      message || "Voice transcription failed",
      activeMetadata,
      { detail: message.slice(0, 500) }
    );
  }
});

module.exports = router;
