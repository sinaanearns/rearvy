export const LOCAL_VOICE_MAX_RECORDING_MS = 10000;
export const LOCAL_VOICE_MIN_AUDIO_BYTES = 768;
export const LOCAL_VOICE_MIME_TYPE_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];
export const DEFAULT_LOCAL_MARIA_API_PORT = 4000;

export type LocalVoiceDebugMetadata = {
  requestId: string;
  audioBytes: number;
  mimeType: string;
  originalMimeType?: string;
  durationMs: number;
  localApiPort?: number;
  endpoint?: string;
};

type VoiceTranscriptionPayload = {
  text?: unknown;
  error?: unknown;
  code?: unknown;
  status?: unknown;
  detail?: unknown;
};

export class LocalVoiceTranscriptionError extends Error {
  code: string;
  status?: number;
  detail?: unknown;
  metadata?: Partial<LocalVoiceDebugMetadata>;

  constructor(
    message: string,
    code: string,
    options: {
      status?: number;
      detail?: unknown;
      metadata?: Partial<LocalVoiceDebugMetadata>;
    } = {}
  ) {
    super(message);
    this.name = "LocalVoiceTranscriptionError";
    this.code = code;
    this.status = options.status;
    this.detail = options.detail;
    this.metadata = options.metadata;
  }
}

function isValidPort(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeVoiceTranscriptionPayload(
  value: unknown
): VoiceTranscriptionPayload | null {
  return isRecord(value) ? value : null;
}

export function hasLocalVoiceCapturePrimitives() {
  return Boolean(
    typeof window !== "undefined" &&
      typeof navigator.mediaDevices?.getUserMedia === "function" &&
      typeof MediaRecorder !== "undefined"
  );
}

export function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isLocalhostOrigin() {
  if (typeof window === "undefined") {
    return false;
  }

  return isLoopbackHostname(window.location.hostname);
}

export function shouldUseLocalVoiceCapture(options: {
  isDesktopWorkspaceAvailable?: boolean;
  localApiPort?: number | null;
  localApiReachable?: boolean;
}) {
  if (!hasLocalVoiceCapturePrimitives()) {
    return false;
  }

  return Boolean(
    options.isDesktopWorkspaceAvailable ||
      isValidPort(options.localApiPort) ||
      options.localApiReachable ||
      window.electron ||
      isLocalhostOrigin()
  );
}

export function createVoiceRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `voice-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function createAudioRecorder(stream: MediaStream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("media-recorder-unavailable");
  }

  for (const mimeType of LOCAL_VOICE_MIME_TYPE_CANDIDATES) {
    try {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        return new MediaRecorder(stream, { mimeType });
      }
    } catch {
      // Try the next MIME type or the browser default.
    }
  }

  return new MediaRecorder(stream);
}

export function sanitizeLocalVoiceMetadata(metadata: Partial<LocalVoiceDebugMetadata>) {
  return {
    requestId: metadata.requestId || "unknown",
    audioBytes: typeof metadata.audioBytes === "number" ? metadata.audioBytes : 0,
    mimeType: metadata.mimeType || "unknown",
    originalMimeType: metadata.originalMimeType,
    durationMs: typeof metadata.durationMs === "number" ? metadata.durationMs : 0,
    localApiPort: metadata.localApiPort,
    endpoint: metadata.endpoint,
  };
}

export function getLocalVoiceFailureMessage(errorOrCode?: unknown) {
  const code =
    errorOrCode instanceof LocalVoiceTranscriptionError
      ? errorOrCode.code
      : typeof errorOrCode === "string"
        ? errorOrCode
        : "";

  if (code === "audio_empty" || code === "audio_missing" || code === "audio_too_small") {
    return "I did not catch that.";
  }

  if (code === "assemblyai_key_missing") {
    return "Voice transcription is unavailable.";
  }

  if (code === "voice_service_unreachable") {
    return "Maria voice service is not running.";
  }

  if (code === "assemblyai_timeout") {
    return "Voice transcription timed out.";
  }

  return "Could not transcribe audio.";
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("Failed to read audio."));
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      resolve(result.includes(",") ? result.split(",")[1] || "" : result);
    };
    reader.readAsDataURL(blob);
  });
}

function writeString(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function audioBufferToWavBlob(audioBuffer: AudioBuffer) {
  const channelCount = Math.min(2, audioBuffer.numberOfChannels || 1);
  const sampleRate = audioBuffer.sampleRate;
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  let offset = 0;

  writeString(view, offset, "RIFF");
  offset += 4;
  view.setUint32(offset, 36 + dataSize, true);
  offset += 4;
  writeString(view, offset, "WAVE");
  offset += 4;
  writeString(view, offset, "fmt ");
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true);
  offset += 4;
  view.setUint16(offset, blockAlign, true);
  offset += 2;
  view.setUint16(offset, 16, true);
  offset += 2;
  writeString(view, offset, "data");
  offset += 4;
  view.setUint32(offset, dataSize, true);
  offset += 4;

  const channels = Array.from({ length: channelCount }, (_, channelIndex) =>
    audioBuffer.getChannelData(channelIndex)
  );
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex]?.[frameIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function prepareAudioForTranscription(blob: Blob, metadata: LocalVoiceDebugMetadata) {
  const originalMimeType = blob.type || metadata.mimeType || "unknown";
  if (originalMimeType === "audio/wav" || originalMimeType === "audio/x-wav") {
    return { blob, metadata: { ...metadata, audioBytes: blob.size, mimeType: originalMimeType } };
  }

  const AudioContextConstructor =
    window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) {
    return { blob, metadata: { ...metadata, audioBytes: blob.size, mimeType: originalMimeType } };
  }

  let audioContext: AudioContext | null = null;
  try {
    audioContext = new AudioContextConstructor();
    const audioBuffer = await audioContext.decodeAudioData(await blob.arrayBuffer());
    const wavBlob = audioBufferToWavBlob(audioBuffer);
    return {
      blob: wavBlob,
      metadata: {
        ...metadata,
        audioBytes: wavBlob.size,
        mimeType: "audio/wav",
        originalMimeType,
      },
    };
  } catch (error) {
    console.warn("[LocalVoice] Falling back to original recording format", {
      ...sanitizeLocalVoiceMetadata(metadata),
      error: error instanceof Error ? error.message : String(error),
    });
    return { blob, metadata: { ...metadata, audioBytes: blob.size, mimeType: originalMimeType } };
  } finally {
    await audioContext?.close().catch(() => undefined);
  }
}

export async function resolveLocalMariaApiPort(preferredPort?: number | null) {
  const electron = typeof window !== "undefined" ? window.electron : null;
  const bridgePort = await electron?.localApiPort?.().catch(() => null);
  if (isValidPort(bridgePort)) {
    return bridgePort;
  }

  if (isValidPort(preferredPort)) {
    return preferredPort;
  }

  return DEFAULT_LOCAL_MARIA_API_PORT;
}

export function buildLocalMariaApiBaseUrl(port: number) {
  return `http://127.0.0.1:${port}`;
}

export async function probeLocalMariaVoiceService(options: {
  localApiPort?: number | null;
  timeoutMs?: number;
} = {}) {
  if (typeof window === "undefined" || !hasLocalVoiceCapturePrimitives()) {
    return { ok: false, port: null as number | null, baseUrl: null as string | null };
  }

  // Avoid attempting HTTP loopback probes from an HTTPS page when the
  // desktop bridge is not present. Browsers will block mixed-content
  // requests (HTTPS page -> http://127.0.0.1) which causes production-only
  // failures; prefer to fail fast and let the UI show the graceful fallback.
  try {
    const isSecure = Boolean(window.location && window.location.protocol === "https:");
    const hasBridge = Boolean(window.electron && typeof window.electron.localApiPort === "function");
    if (isSecure && !hasBridge) {
      return { ok: false, port: null as number | null, baseUrl: null as string | null };
    }
  } catch {
    // ignore and continue to probe
  }

  const port = await resolveLocalMariaApiPort(options.localApiPort);
  const baseUrl = buildLocalMariaApiBaseUrl(port);
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), options.timeoutMs ?? 900);

  try {
    const response = await fetch(`${baseUrl}/api/internal/maria/status`, {
      cache: "no-store",
      signal: controller.signal,
    });
    return { ok: response.ok, port, baseUrl };
  } catch {
    return { ok: false, port, baseUrl };
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function transcribeWithLocalMaria(
  blob: Blob,
  metadata: LocalVoiceDebugMetadata,
  options: { localApiPort?: number | null } = {}
) {
  // Avoid attempting to upload to an insecure loopback endpoint from a
  // secure hosted page when the desktop bridge is not available.
  try {
    const isSecure = Boolean(typeof window !== "undefined" && window.location && window.location.protocol === "https:");
    const hasBridge = Boolean(typeof window !== "undefined" && window.electron && typeof window.electron.localApiPort === "function");
    if (isSecure && !hasBridge) {
      throw new LocalVoiceTranscriptionError(
        "Local Maria transcription is not available from a secure hosted page. Use the desktop app or enable a secure bridge.",
        "local_maria_unavailable",
        { metadata: sanitizeLocalVoiceMetadata(metadata) }
      );
    }
  } catch (err) {
    if (err instanceof LocalVoiceTranscriptionError) throw err;
    // fallthrough
  }
  const prepared = await prepareAudioForTranscription(blob, metadata);
  const uploadBlob = prepared.blob;
  const uploadMetadata = prepared.metadata;
  const audio = await blobToBase64(uploadBlob);
  if (!audio) {
    throw new LocalVoiceTranscriptionError("No audio was captured.", "audio_empty", {
      metadata: uploadMetadata,
    });
  }

  const localApiPort = await resolveLocalMariaApiPort(options.localApiPort ?? metadata.localApiPort);
  const endpoint = `${buildLocalMariaApiBaseUrl(localApiPort)}/api/internal/maria/transcribe`;
  const requestMetadata = sanitizeLocalVoiceMetadata({
    ...uploadMetadata,
    endpoint,
    localApiPort,
  });

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audio,
        contentType: uploadMetadata.mimeType,
        requestId: uploadMetadata.requestId,
        metadata: {
          audioBytes: uploadMetadata.audioBytes,
          durationMs: uploadMetadata.durationMs,
          mimeType: uploadMetadata.mimeType,
          originalMimeType: uploadMetadata.originalMimeType,
        },
      }),
    });
  } catch (error) {
    throw new LocalVoiceTranscriptionError(
      "Maria voice service is not running.",
      "voice_service_unreachable",
      { detail: error, metadata: requestMetadata }
    );
  }

  const payload = normalizeVoiceTranscriptionPayload(
    await response.json().catch(() => null)
  );

  if (!response.ok) {
    const code =
      typeof payload?.code === "string"
        ? payload.code
        : response.status === 501
          ? "assemblyai_key_missing"
          : "voice_transcription_failed";

    throw new LocalVoiceTranscriptionError(
      typeof payload?.error === "string" ? payload.error : getLocalVoiceFailureMessage(code),
      code,
      {
        status: response.status,
        detail: payload?.detail,
        metadata: requestMetadata,
      }
    );
  }

  return String(payload?.text || "").trim();
}
