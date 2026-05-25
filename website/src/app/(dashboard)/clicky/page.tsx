"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MousePointer2, Play } from "lucide-react";
import {
  ClickyVoiceAgentError,
  ClickyVoiceAgentSession,
  getClickyVoiceAgentFailureMessage,
  type ClickyVoiceAgentStatus,
  type ClickyVoiceAgentToolRequest,
  type ClickyVoiceAgentToolResult,
} from "@/lib/clicky/voice-agent";
import { getIdToken } from "@/lib/firebase/auth";
import { isScreenAnalysisRequest } from "@/lib/screen-intent";

type ClickyResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type ClickyCommandPayload = {
  command: string;
  requestId: string;
  origin: "clicky-page" | "maria";
};

type ClickyCommandResult = {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
};

const MAX_VOICE_RECORDING_MS = 10000;
const MIN_VOICE_AUDIO_BYTES = 768;
const CLICKY_PAGE_ORIGIN = "clicky-page";
const VOICE_MIME_TYPE_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];

type VoiceDebugMetadata = {
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

class VoiceTranscriptionError extends Error {
  code: string;
  status?: number;
  detail?: unknown;
  metadata?: Partial<VoiceDebugMetadata>;

  constructor(
    message: string,
    code: string,
    options: {
      status?: number;
      detail?: unknown;
      metadata?: Partial<VoiceDebugMetadata>;
    } = {}
  ) {
    super(message);
    this.name = "VoiceTranscriptionError";
    this.code = code;
    this.status = options.status;
    this.detail = options.detail;
    this.metadata = options.metadata;
  }
}

function createClickyPayload(
  command: string,
  requestId = crypto.randomUUID(),
  origin: ClickyCommandPayload["origin"] = CLICKY_PAGE_ORIGIN
): ClickyCommandPayload {
  return {
    command,
    requestId,
    origin,
  };
}

function readReplyText(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const result = value as ClickyCommandResult;
  return String(result.reply || result.message || "").trim();
}

function buildClickyToolResult(value: unknown, fallbackMessage: string): ClickyVoiceAgentToolResult {
  const result = value && typeof value === "object" ? (value as ClickyCommandResult) : null;
  const ok = !result || result.ok !== false;
  const reply = readReplyText(value) || (ok ? fallbackMessage : String(result?.error || "Clicky could not complete that."));

  return {
    ok,
    reply,
    message: reply,
    data: value,
  };
}

function createAudioRecorder(stream: MediaStream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("media-recorder-unavailable");
  }

  for (const mimeType of VOICE_MIME_TYPE_CANDIDATES) {
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

function sanitizeVoiceDebugMetadata(metadata: Partial<VoiceDebugMetadata>) {
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

function getVoiceFailureMessage(error: unknown) {
  if (!(error instanceof VoiceTranscriptionError)) {
    return "I could not transcribe that.";
  }

  if (error.code === "audio_empty" || error.code === "audio_missing" || error.code === "audio_too_small") {
    return "I did not catch that.";
  }

  if (error.code === "assemblyai_key_missing") {
    return "Voice transcription is unavailable.";
  }

  if (error.code === "voice_service_unreachable") {
    return "Clicky voice service is not running.";
  }

  if (error.code === "assemblyai_timeout") {
    return "Voice transcription timed out.";
  }

  if (
    error.code === "assemblyai_upload_failed" ||
    error.code === "assemblyai_transcript_create_failed" ||
    error.code === "assemblyai_transcript_check_failed" ||
    error.code === "assemblyai_transcription_failed" ||
    error.code === "assemblyai_network_error"
  ) {
    return "Voice transcription failed on AssemblyAI.";
  }

  return "I could not transcribe that.";
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
  for (let index = 0; index < value.length; index++) {
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
  for (let frameIndex = 0; frameIndex < frameCount; frameIndex++) {
    for (let channelIndex = 0; channelIndex < channelCount; channelIndex++) {
      const sample = Math.max(-1, Math.min(1, channels[channelIndex]?.[frameIndex] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

async function prepareAudioForTranscription(blob: Blob, metadata: VoiceDebugMetadata) {
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
    const nextMetadata = {
      ...metadata,
      audioBytes: wavBlob.size,
      mimeType: "audio/wav",
      originalMimeType,
    };
    console.info("[ClickyVoice] Converted recording for transcription", sanitizeVoiceDebugMetadata(nextMetadata));
    return { blob: wavBlob, metadata: nextMetadata };
  } catch (error) {
    console.warn("[ClickyVoice] Falling back to original recording format", {
      ...sanitizeVoiceDebugMetadata(metadata),
      error: error instanceof Error ? error.message : String(error),
    });
    return { blob, metadata: { ...metadata, audioBytes: blob.size, mimeType: originalMimeType } };
  } finally {
    await audioContext?.close().catch(() => undefined);
  }
}

function getSpeechRecognitionErrorCode(error: unknown) {
  if (error && typeof error === "object") {
    const record = error as { error?: unknown; message?: unknown; type?: unknown };
    if (typeof record.error === "string" && record.error) {
      return record.error;
    }
    if (typeof record.message === "string" && record.message) {
      return record.message;
    }
    if (typeof record.type === "string" && record.type) {
      return record.type;
    }
  }

  return "unknown";
}

export default function ClickyPage() {
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMariaActive, setIsMariaActive] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const [assistantNote, setAssistantNote] = useState("Clicky is available in the sidebar and as a cursor-following desktop bubble.");
  const [assistantResults, setAssistantResults] = useState<ClickyResult[]>([]);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const wakeRecognitionRestartTimerRef = useRef<number | null>(null);
  const wakeRecognitionFailureCountRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceRecordingRequestIdRef = useRef("");
  const voiceAgentSessionRef = useRef<ClickyVoiceAgentSession | null>(null);
  const mariaStopRequestedRef = useRef(false);
  const mariaSessionVersionRef = useRef(0);

  const lookupWorkbookContext = async (query: string): Promise<ClickyResult[]> => {
    try {
      const token = await getIdToken();
      if (!token) {
        return [];
      }

      const response = await fetch(`/api/integrations/excel/search?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return [];
      }

      const payload = await response.json();
      const rows = Array.isArray(payload?.rows) ? payload.rows : [];

      return rows.map((row: any) => {
        const data = row?.data || {};
        const employeeName = data.employee || data.employee_name || data.name || data.person || "Employee record";
        const salary = data.salary ?? data.amount ?? data.pay ?? data.payment ?? "unknown";
        const leaveDeduction = data.leave_deduction ?? data.leave ?? data.deduction ?? "unknown";
        const total = data.total ?? data.net_salary ?? data.net_pay ?? "unknown";
        const summaryParts = [
          employeeName ? `Employee: ${employeeName}` : null,
          salary !== "unknown" ? `Salary: ${salary}` : null,
          leaveDeduction !== "unknown" ? `Leave deduction: ${leaveDeduction}` : null,
          total !== "unknown" ? `Total: ${total}` : null,
        ].filter(Boolean);

        return {
          title: String(employeeName),
          url: "",
          description: summaryParts.join(" • "),
          summary: summaryParts.join(" • "),
        };
      });
    } catch {
      return [];
    }
  };

  // Persist wake-word preference
  useEffect(() => {
    try {
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  const getLocalClickyTranscriptionTarget = async () => {
    const port = await (window as any).electron?.localApiPort?.().catch(() => null);
    const localApiPort = typeof port === "number" && Number.isFinite(port) ? port : 4000;
    return {
      localApiPort,
      url: `http://127.0.0.1:${localApiPort}/api/internal/clicky/transcribe`,
    };
  };

  const transcribeAudio = async (blob: Blob, metadata: VoiceDebugMetadata) => {
    const prepared = await prepareAudioForTranscription(blob, metadata);
    const uploadBlob = prepared.blob;
    const uploadMetadata = prepared.metadata;
    const audio = await blobToBase64(uploadBlob);
    if (!audio) {
      throw new VoiceTranscriptionError("No audio was captured.", "audio_empty", { metadata: uploadMetadata });
    }

    const target = await getLocalClickyTranscriptionTarget();
    const requestMetadata = sanitizeVoiceDebugMetadata({
      ...uploadMetadata,
      endpoint: target.url,
      localApiPort: target.localApiPort,
    });

    console.info("[ClickyVoice] Sending transcription request", requestMetadata);

    let response: Response;
    try {
      response = await fetch(target.url, {
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
    } catch {
      throw new VoiceTranscriptionError("Clicky voice service is not running.", "voice_service_unreachable", {
        metadata: requestMetadata,
      });
    }

    let payload: VoiceTranscriptionPayload | null = null;
    try {
      payload = await response.json();
    } catch {}

    if (!response.ok) {
      const code =
        typeof payload?.code === "string"
          ? payload.code
          : response.status === 501
            ? "assemblyai_key_missing"
            : "voice_transcription_failed";
      throw new VoiceTranscriptionError(
        typeof payload?.error === "string" ? payload.error : "Voice transcription failed.",
        code,
        {
          status: response.status,
          detail: payload?.detail,
          metadata: requestMetadata,
        }
      );
    }

    return String(payload?.text || "").trim();
  };

  const clearRecordingTimeout = () => {
    if (recordingTimeoutRef.current !== null) {
      window.clearTimeout(recordingTimeoutRef.current);
      recordingTimeoutRef.current = null;
    }
  };

  const stopRecordingTracks = () => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  };

  const handleAction = async (action: string, requestId = crypto.randomUUID()) => {
    const command = action.trim();
    if (!command) return;

    setLastCommand(command);
    setAssistantNote(`Running: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      if ((window as any).electron?.clicky?.runCommand) {
        const result = await (window as any).electron.clicky.runCommand(createClickyPayload(command, requestId));
        const reply = readReplyText(result);
        if (reply) {
          setAssistantNote(reply);
        }
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to run clicky command:", err);
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleResearch = async (query: string, requestId = crypto.randomUUID()) => {
    setLastCommand(query);
    setAssistantNote(`Researching: ${query}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      if (isScreenAnalysisRequest(query) && (window as any).electron?.clicky?.runCommand) {
        const result = await (window as any).electron.clicky.runCommand(createClickyPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          setAssistantNote(reply);
        }
        return;
      }

      if ((window as any).electron?.clicky?.research) {
        const result = await (window as any).electron.clicky.research(createClickyPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          setAssistantNote(reply);
        }
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to research with clicky:", err);
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const applyMariaStatus = (nextStatus: ClickyVoiceAgentStatus) => {
    setStatus(nextStatus);
    setIsBusy(nextStatus === "Connecting" || nextStatus === "Maria speaking" || nextStatus === "Running Clicky action");
    if (nextStatus === "Disconnected" || nextStatus === "Voice Agent unavailable") {
      setIsMariaActive(false);
      voiceAgentSessionRef.current = null;
    }
  };

  const runMariaClickyTool = async ({
    command,
    mode,
  }: ClickyVoiceAgentToolRequest): Promise<ClickyVoiceAgentToolResult> => {
    const requestId = crypto.randomUUID();
    const payload = createClickyPayload(command, requestId, "maria");

    setLastCommand(`Maria: ${command}`);
    setAssistantNote(`Running Clicky action: ${command}`);
    setStatus("Running Clicky action");
    setIsBusy(true);

    try {
      const clicky = (window as any).electron?.clicky;
      if (mode === "research" && clicky?.research && !isScreenAnalysisRequest(command)) {
        const result = await clicky.research(payload);
        return buildClickyToolResult(result, "Clicky research completed.");
      }

      if (clicky?.runCommand) {
        const result = await clicky.runCommand(payload);
        return buildClickyToolResult(result, "Clicky completed the command.");
      }

      setStatus("Desktop bridge unavailable");
      setAssistantNote("Open Clicky in the desktop app to run commands.");
      return {
        ok: false,
        message: "Desktop bridge unavailable.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to run Maria Clicky tool:", error);
      setStatus("Error");
      setAssistantNote("Clicky could not run that action.");
      return {
        ok: false,
        message,
      };
    } finally {
      setIsBusy(false);
    }
  };

  const shouldFallbackToTranscription = (error: unknown) => {
    return (
      error instanceof ClickyVoiceAgentError &&
      ["voice_agent_ws_error", "voice_agent_ws_closed", "voice_agent_ready_timeout", "voice_agent_session_error"].includes(
        error.code
      )
    );
  };

  const stopMariaSession = async () => {
    const session = voiceAgentSessionRef.current;
    mariaStopRequestedRef.current = true;
    mariaSessionVersionRef.current += 1;
    voiceAgentSessionRef.current = null;
    setIsMariaActive(false);
    await session?.stop().catch(() => undefined);
    setAssistantNote("Maria disconnected.");
    setStatus("Disconnected");
    setIsBusy(false);
  };

  const startMariaSession = async () => {
    if (voiceAgentSessionRef.current) {
      return;
    }

    const sessionVersion = mariaSessionVersionRef.current + 1;
    mariaSessionVersionRef.current = sessionVersion;
    const isCurrentMariaSession = () => mariaSessionVersionRef.current === sessionVersion;
    const session = new ClickyVoiceAgentSession({
      onStatus: (nextStatus) => {
        if (isCurrentMariaSession()) {
          applyMariaStatus(nextStatus);
        }
      },
      onNote: (note) => {
        if (isCurrentMariaSession()) {
          setAssistantNote(note);
        }
      },
      onToolCall: async (request) => {
        if (!isCurrentMariaSession()) {
          return {
            ok: false,
            message: "Maria session stopped.",
          };
        }

        return await runMariaClickyTool(request);
      },
      onError: (message, error) => {
        if (!isCurrentMariaSession()) {
          return;
        }

        console.warn("[ClickyVoiceAgent] Maria error", error);
        setAssistantNote(message);
      },
    });

    voiceAgentSessionRef.current = session;
    mariaStopRequestedRef.current = false;
    setIsMariaActive(true);

    try {
      await session.start();
    } catch (error) {
      if (!isCurrentMariaSession()) {
        return;
      }

      if (
        mariaStopRequestedRef.current ||
        (error instanceof ClickyVoiceAgentError && error.code === "voice_agent_disconnected")
      ) {
        mariaStopRequestedRef.current = false;
        setIsMariaActive(false);
        setAssistantNote("Maria disconnected.");
        setStatus("Disconnected");
        setIsBusy(false);
        return;
      }

      const fallbackToTranscription = shouldFallbackToTranscription(error);
      const message = getClickyVoiceAgentFailureMessage(error);

      console.warn("[ClickyVoiceAgent] Maria failed to start", error);
      if (voiceAgentSessionRef.current === session) {
        voiceAgentSessionRef.current = null;
      }
      setIsMariaActive(false);
      await session.stop().catch(() => undefined);
      setAssistantNote(message);
      setStatus("Voice Agent unavailable");
      setIsBusy(false);

      if (fallbackToTranscription) {
        setAssistantNote("Voice Agent unavailable. Falling back to transcription.");
        void startVoiceRecording();
      }
    }
  };

  const finishVoiceRecording = async (blob: Blob, metadata: VoiceDebugMetadata) => {
    const voiceMetadata = sanitizeVoiceDebugMetadata({
      ...metadata,
      audioBytes: blob.size,
      mimeType: blob.type || metadata.mimeType,
    });

    if (!blob.size || blob.size < MIN_VOICE_AUDIO_BYTES) {
      console.warn("[ClickyVoice] Recording too small to transcribe", voiceMetadata);
      setAssistantNote("I did not catch that.");
      setStatus("Ready");
      return;
    }

    setAssistantNote("Transcribing your voice...");
    setStatus("Transcribing");
    setIsBusy(true);

    try {
      const transcript = await transcribeAudio(blob, {
        ...metadata,
        audioBytes: blob.size,
        mimeType: blob.type || metadata.mimeType,
      });
      if (!transcript) {
        setAssistantNote("I did not catch that.");
        setStatus("Ready");
        return;
      }

      const requestId = crypto.randomUUID();
      setInputText("");
      setLastCommand(`Voice: ${transcript}`);
      setAssistantNote(`Voice command received: ${transcript}`);
      await handleAction(transcript, requestId);
    } catch (error) {
      const message = getVoiceFailureMessage(error);
      if (error instanceof VoiceTranscriptionError) {
        console.warn("[ClickyVoice] Transcription failed", {
          code: error.code,
          status: error.status,
          detail: error.detail,
          metadata: sanitizeVoiceDebugMetadata(error.metadata || metadata),
        });
      } else {
        console.warn("[ClickyVoice] Transcription failed", error);
      }
      setAssistantNote(message);
      setStatus("Voice transcription failed");
    } finally {
      setIsBusy(false);
    }
  };

  const stopVoiceRecording = () => {
    clearRecordingTimeout();
    const recorder = mediaRecorderRef.current;
    if (!recorder) {
      setIsRecording(false);
      stopRecordingTracks();
      return;
    }

    if (recorder.state !== "inactive") {
      try {
        recorder.requestData();
      } catch {}
      recorder.stop();
    }
  };

  const startVoiceRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setAssistantNote("Microphone unavailable.");
      setStatus("Microphone unavailable");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createAudioRecorder(stream);
      const requestId = crypto.randomUUID();
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recordingStartedAtRef.current = performance.now();
      voiceRecordingRequestIdRef.current = requestId;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimeout();
        const durationMs =
          recordingStartedAtRef.current === null
            ? 0
            : Math.max(0, Math.round(performance.now() - recordingStartedAtRef.current));
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const metadata: VoiceDebugMetadata = {
          requestId: voiceRecordingRequestIdRef.current || crypto.randomUUID(),
          audioBytes: blob.size,
          mimeType: blob.type || recorder.mimeType || "unknown",
          durationMs,
        };

        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingStartedAtRef.current = null;
        voiceRecordingRequestIdRef.current = "";
        setIsRecording(false);
        stopRecordingTracks();
        void finishVoiceRecording(blob, metadata);
      };

      recorder.start();
      setIsRecording(true);
      setStatus("Listening");
      setAssistantNote("Listening. Click again to send.");
      recordingTimeoutRef.current = window.setTimeout(stopVoiceRecording, MAX_VOICE_RECORDING_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      const message =
        errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
          ? "Microphone permission needed."
          : "Could not start microphone recording.";
      setAssistantNote(message);
      setStatus(message);
      setIsRecording(false);
      recordingStartedAtRef.current = null;
      voiceRecordingRequestIdRef.current = "";
      stopRecordingTracks();
    }
  };

  const handleVoiceButton = () => {
    if (isMariaActive) {
      void stopMariaSession();
      return;
    }

    if (isRecording) {
      setAssistantNote("Sending voice command...");
      setStatus("Processing voice");
      stopVoiceRecording();
      return;
    }

    void startMariaSession();
  };

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      if (wakeRecognitionRestartTimerRef.current !== null) {
        window.clearTimeout(wakeRecognitionRestartTimerRef.current);
        wakeRecognitionRestartTimerRef.current = null;
      }
      try {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current?.stop();
        }
      } catch {}
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      recordingStartedAtRef.current = null;
      voiceRecordingRequestIdRef.current = "";
      void voiceAgentSessionRef.current?.stop();
      voiceAgentSessionRef.current = null;
    };
  }, []);

  // Wake-word speech recognition (listen for "hey clicky <command>")
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !allowWake || isMariaActive) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      return;
    }

    let mounted = true;
    let nextRestartDelayMs = 500;

    const clearRestartTimer = () => {
      if (wakeRecognitionRestartTimerRef.current !== null) {
        window.clearTimeout(wakeRecognitionRestartTimerRef.current);
        wakeRecognitionRestartTimerRef.current = null;
      }
    };

    const scheduleRecognitionRestart = (delayMs = 500) => {
      clearRestartTimer();
      wakeRecognitionRestartTimerRef.current = window.setTimeout(() => {
        wakeRecognitionRestartTimerRef.current = null;
        if (mounted && allowWake && !isMariaActive) {
          startRecognition();
        }
      }, delayMs);
    };

    const disableWakeRecognition = (nextStatus: string) => {
      mounted = false;
      clearRestartTimer();
      setAllowWake(false);
      setStatus(nextStatus);
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };

    const startRecognition = () => {
      if (!mounted || recognitionRef.current) {
        return;
      }

      try {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;

        rec.onresult = (e: any) => {
          try {
            wakeRecognitionFailureCountRef.current = 0;
            const transcripts = Array.from(e.results)
              .map((r: any) => r[0].transcript)
              .join(" ")
              .trim();
            const txt = transcripts.toLowerCase();
            if (txt.includes("hey clicky")) {
              const parts = txt.split("hey clicky");
              const cmd = parts.slice(1).join(" ").trim();
              if (cmd) {
                setLastCommand(`Voice: ${cmd}`);
                setAssistantNote(`Voice command received: ${cmd}`);
                handleAction(cmd);
              } else {
                setStatus("Heard wake word");
              }
            }
          } catch (err) {
            console.error("processing speech result", err);
          }
        };

        rec.onend = () => {
          if (recognitionRef.current === rec) {
            recognitionRef.current = null;
          }

          if (allowWake && mounted) {
            scheduleRecognitionRestart(nextRestartDelayMs);
            nextRestartDelayMs = 500;
          }
        };

        rec.onerror = (err: any) => {
          const errorCode = getSpeechRecognitionErrorCode(err);

          if (errorCode === "no-speech") {
            nextRestartDelayMs = 750;
            setStatus("Listening");
            return;
          }

          if (errorCode === "aborted" || errorCode === "network") {
            wakeRecognitionFailureCountRef.current += 1;
            if (wakeRecognitionFailureCountRef.current >= 3) {
              console.warn("Speech recognition unavailable", errorCode);
              disableWakeRecognition("Wakeword unavailable");
            } else {
              nextRestartDelayMs = 1000 * wakeRecognitionFailureCountRef.current;
              setStatus("Listening");
            }
            return;
          }

          if (errorCode === "not-allowed" || errorCode === "service-not-allowed" || errorCode === "audio-capture") {
            disableWakeRecognition(errorCode === "audio-capture" ? "Microphone unavailable" : "Microphone permission needed");
            return;
          }

          console.warn("Speech recognition stopped", errorCode);
          disableWakeRecognition("Wakeword unavailable");
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.error("Failed to start speech recognition", err);
        disableWakeRecognition("Wakeword unavailable");
      }
    };

    if (allowWake) startRecognition();

    return () => {
      mounted = false;
      clearRestartTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [allowWake, isMariaActive]);

  const quickActions = [
    "Open Shopify dashboard",
    "Research latest campaign metrics",
    "Take a screenshot and tell me what you see",
    "Guide me through the next step",
  ];

  // Listen for status updates from the desktop brain bridge.
  useEffect(() => {
    if ((window as any).electron?.clicky) {
      const unsubscribe = (window as any).electron.clicky.onStatus((newStatus: string) => {
        setStatus(newStatus);
        setIsBusy(newStatus !== "Ready");
        if (newStatus !== "Ready") setLastCommand(newStatus);
      });
      const unsubscribeEvents = (window as any).electron.clicky.onAssistantEvent((event: any) => {
        if (event?.type === "research-started") {
          setAssistantNote(`Researching: ${event.query}`);
          setAssistantResults([]);
        }

        if (event?.type === "research-completed") {
          setAssistantNote(event.headline ? `Research complete: ${event.headline}` : "Research complete");
          setAssistantResults(Array.isArray(event.results) ? event.results : []);
        }

        if (event?.type === "scrape-completed") {
          setAssistantNote(event.result?.title ? `Scraped: ${event.result.title}` : "Scrape complete");
          setAssistantResults([
            {
              title: event.result?.title || event.url,
              url: event.result?.url || event.url,
              description: event.result?.summary || "",
              summary: event.result?.summary || "",
            },
          ]);
        }

        if (event?.type === "screen-analysis-started") {
          setAssistantNote("Analyzing the current screen...");
          setAssistantResults([]);
        }

        if (event?.type === "screen-analysis-completed") {
          setAssistantNote(event?.reply || "Screen analysis complete.");
          setAssistantResults([]);
        }

        if (event?.type === "screen-analysis-failed") {
          setAssistantNote(event?.message || "Clicky could not capture the screen.");
          setAssistantResults([]);
        }

        if (event?.type === "assistant-reply") {
          const reply = String(event?.reply || event?.message || "Clicky replied.");
          setAssistantNote(reply);
        }

        if (event?.type === "policy-response" || event?.type === "command-blocked") {
          setAssistantNote(event?.message || "I can’t help with that request.");
          setAssistantResults([]);
        }

        if (event?.type === "decision-needed") {
          setAssistantNote(event?.question || "I need your approval before continuing.");
          setLastCommand(event?.userFacingSummary || "Approval needed");
          setStatus("Waiting for approval");
          setIsBusy(false);
          void (async () => {
            const rows = await lookupWorkbookContext(String(event?.command || event?.question || ""));
            if (rows.length > 0) {
              setAssistantResults(rows);
            } else if (event?.ifNoOption) {
              setAssistantNote(event.ifNoOption);
              setAssistantResults([]);
            }
          })();
        }

        if (event?.type === "decision-approved") {
          setAssistantNote("Approval received. Continuing now.");
        }
      });
      return () => {
        unsubscribe();
        unsubscribeEvents();
      };
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    void handleAction(inputText);
    setInputText("");
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full flex-col gap-6 px-4 py-5 md:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <MousePointer2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Clicky</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sidebar voice and command control for Rearvy, with a cursor-following desktop bubble.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <span className={`h-2 w-2 rounded-full ${isBusy ? "bg-amber-500" : "bg-emerald-500"}`} />
            {status}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            {lastCommand}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Command Center</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Type a command, use a quick action, or start Maria for live voice while this page is open.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
              placeholder="Ask Clicky to click, search, explain, or open something..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60"
                disabled={!inputText.trim()}
              >
                <Play className="h-4 w-4" />
                Send command
              </button>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
                onClick={() => (action.startsWith("Research") ? void handleResearch(action) : void handleAction(action))}
              >
                {action}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleVoiceButton}
            aria-pressed={isMariaActive || isRecording}
            className={`inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm transition-colors ${
              isMariaActive || isRecording
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "border-slate-300 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
            }`}
          >
            <Mic className="h-4 w-4" />
            {isMariaActive ? "Stop Maria" : isRecording ? "Stop and send" : "Start Maria"}
          </button>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Assistant Feed</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Command history and any research or workbook context that Clicky returns.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Assistant note
            </div>
            <div className="mt-2 text-sm text-slate-800 dark:text-slate-100">{assistantNote}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Results
            </div>

            {assistantResults.length > 0 ? (
              <div className="mt-3 space-y-3">
                {assistantResults.map((result) => (
                  <a
                    key={result.url || result.title}
                    href={result.url || undefined}
                    target={result.url ? "_blank" : undefined}
                    rel={result.url ? "noreferrer" : undefined}
                    className="block rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
                  >
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">{result.title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{result.summary || result.description}</div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No results yet. Use a research action or ask Clicky to inspect something.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span>Desktop bridge</span>
            <span className={isBusy ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
              {isBusy ? "Working" : "Ready"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
