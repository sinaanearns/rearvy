"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowUpRight,
  Bot,
  CheckCircle2,
  Command,
  FileSearch,
  Mic,
  MonitorCheck,
  MousePointer2,
  SendHorizontal,
  Sparkles,
} from "lucide-react";
import {
  MariaVoiceAgentError,
  MariaVoiceAgentSession,
  getMariaVoiceAgentFailureMessage,
  type MariaVoiceAgentStatus,
  type MariaVoiceAgentToolRequest,
  type MariaVoiceAgentToolResult,
} from "@/lib/maria/voice-agent";
import {
  LOCAL_VOICE_MAX_RECORDING_MS,
  LOCAL_VOICE_MIN_AUDIO_BYTES,
  LocalVoiceTranscriptionError,
  createAudioRecorder,
  createVoiceRequestId,
  getLocalVoiceFailureMessage,
  sanitizeLocalVoiceMetadata,
  transcribeWithLocalMaria,
  type LocalVoiceDebugMetadata,
} from "@/lib/maria/local-transcription";
import { isScreenAnalysisRequest } from "@/lib/screen-intent";

type MariaResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type MariaCommandPayload = {
  command: string;
  requestId: string;
  origin: "maria-page" | "maria";
};

type MariaCommandResult = {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
};

type MariaConversationRole = "user" | "assistant" | "system";

type MariaConversationMessage = {
  id: string;
  role: MariaConversationRole;
  speaker: string;
  text: string;
};

type MariaSpeechRecognitionEvent = {
  results: ArrayLike<{ [index: number]: { transcript?: string } | undefined }>;
};

type MariaSpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
  type?: string;
};

type MariaSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: MariaSpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: MariaSpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type MariaSpeechRecognitionConstructor = new () => MariaSpeechRecognition;

const MARIA_PAGE_ORIGIN = "maria-page";

function createMariaPayload(
  command: string,
  requestId = crypto.randomUUID(),
  origin: MariaCommandPayload["origin"] = MARIA_PAGE_ORIGIN
): MariaCommandPayload {
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

  const result = value as MariaCommandResult;
  return String(result.reply || result.message || "").trim();
}

function getElectronBridge() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.electron ?? null;
}

function getSpeechRecognitionConstructor() {
  if (typeof window === "undefined") {
    return null;
  }

  const speechWindow = window as Window & {
    SpeechRecognition?: MariaSpeechRecognitionConstructor;
    webkitSpeechRecognition?: MariaSpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
}

function buildMariaToolResult(value: unknown, fallbackMessage: string): MariaVoiceAgentToolResult {
  const result = value && typeof value === "object" ? (value as MariaCommandResult) : null;
  const ok = !result || result.ok !== false;
  const reply = readReplyText(value) || (ok ? fallbackMessage : String(result?.error || "Maria could not complete that."));

  return {
    ok,
    reply,
    message: reply,
    data: value,
  };
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

export default function MariaPage() {
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMariaActive, setIsMariaActive] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const [assistantNote, setAssistantNote] = useState("Maria is available in the sidebar and as a cursor-following desktop bubble.");
  const [assistantResults, setAssistantResults] = useState<MariaResult[]>([]);
  const [conversationMessages, setConversationMessages] = useState<MariaConversationMessage[]>([]);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("maria.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<MariaSpeechRecognition | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordingTimeoutRef = useRef<number | null>(null);
  const wakeRecognitionRestartTimerRef = useRef<number | null>(null);
  const wakeRecognitionFailureCountRef = useRef(0);
  const recordingStartedAtRef = useRef<number | null>(null);
  const voiceRecordingRequestIdRef = useRef("");
  const voiceAgentSessionRef = useRef<MariaVoiceAgentSession | null>(null);
  const mariaStopRequestedRef = useRef(false);
  const mariaSessionVersionRef = useRef(0);
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const appendConversationMessage = useCallback(
    (role: MariaConversationRole, text: unknown, speaker = role === "user" ? "You" : "Maria") => {
      const messageText = typeof text === "string" ? text.trim() : "";
      if (!messageText) {
        return;
      }

      setConversationMessages((messages) => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage?.role === role && lastMessage.speaker === speaker && lastMessage.text === messageText) {
          return messages;
        }

        const nextMessages = [
          ...messages,
          {
            id: crypto.randomUUID(),
            role,
            speaker,
            text: messageText,
          },
        ];

        return nextMessages;
      });
    },
    []
  );

  // Persist wake-word preference
  useEffect(() => {
    try {
      localStorage.setItem("maria.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ block: "end" });
  }, [conversationMessages.length]);

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

    appendConversationMessage("user", command);
    setLastCommand(command);
    setAssistantNote(`Running: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const maria = getElectronBridge()?.maria;
      if (maria?.runCommand) {
        const result = await maria.runCommand(createMariaPayload(command, requestId));
        const reply = readReplyText(result);
        if (reply) {
          appendConversationMessage("assistant", reply);
          setAssistantNote(reply);
        }
      } else {
        appendConversationMessage("assistant", "Desktop bridge unavailable.");
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to run maria command:", err);
      appendConversationMessage("assistant", "Maria could not run that command.");
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleResearch = async (query: string, requestId = crypto.randomUUID()) => {
    appendConversationMessage("user", query);
    setLastCommand(query);
    setAssistantNote(`Researching: ${query}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const maria = getElectronBridge()?.maria;
      if (isScreenAnalysisRequest(query) && maria?.runCommand) {
        const result = await maria.runCommand(createMariaPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          appendConversationMessage("assistant", reply);
          setAssistantNote(reply);
        }
        return;
      }

      if (maria?.research) {
        const result = await maria.research(createMariaPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          appendConversationMessage("assistant", reply);
          setAssistantNote(reply);
        }
      } else {
        appendConversationMessage("assistant", "Desktop bridge unavailable.");
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to research with maria:", err);
      appendConversationMessage("assistant", "Maria could not finish the research request.");
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const applyMariaStatus = (nextStatus: MariaVoiceAgentStatus) => {
    setStatus(nextStatus);
    setIsBusy(
      nextStatus === "Connecting" ||
        nextStatus === "Maria thinking" ||
        nextStatus === "Maria speaking" ||
        nextStatus === "Running Maria action"
    );
    if (nextStatus === "Disconnected" || nextStatus === "Voice Agent unavailable") {
      setIsMariaActive(false);
      voiceAgentSessionRef.current = null;
    }
  };

  const runMariaTool = async ({
    command,
    mode,
  }: MariaVoiceAgentToolRequest): Promise<MariaVoiceAgentToolResult> => {
    const requestId = crypto.randomUUID();
    const payload = createMariaPayload(command, requestId, "maria");

    appendConversationMessage("system", command, mode === "research" ? "Research action" : "Maria action");
    setLastCommand(`Maria: ${command}`);
    setAssistantNote(`Running Maria action: ${command}`);
    setStatus("Running Maria action");
    setIsBusy(true);

    try {
      const maria = getElectronBridge()?.maria;
      if (mode === "research" && maria?.research && !isScreenAnalysisRequest(command)) {
        const result = await maria.research(payload);
        return buildMariaToolResult(result, "Maria research completed.");
      }

      if (maria?.runCommand) {
        const result = await maria.runCommand(payload);
        return buildMariaToolResult(result, "Maria completed the command.");
      }

      setStatus("Desktop bridge unavailable");
      setAssistantNote("Open Maria in the desktop app to run commands.");
      appendConversationMessage("assistant", "Open Maria in the desktop app to run commands.");
      return {
        ok: false,
        message: "Desktop bridge unavailable.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to run Maria tool:", error);
      setStatus("Error");
      setAssistantNote("Maria could not run that action.");
      appendConversationMessage("assistant", "Maria could not run that action.");
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
      error instanceof MariaVoiceAgentError &&
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
    appendConversationMessage("system", "Maria disconnected.", "Session");
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
    const session = new MariaVoiceAgentSession({
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
      onTranscript: (transcript) => {
        if (isCurrentMariaSession()) {
          appendConversationMessage(transcript.role, transcript.text, transcript.role === "user" ? "You" : "Maria");
        }
      },
      onToolCall: async (request) => {
        if (!isCurrentMariaSession()) {
          return {
            ok: false,
            message: "Maria session stopped.",
          };
        }

        return await runMariaTool(request);
      },
      onError: (message, error) => {
        if (!isCurrentMariaSession()) {
          return;
        }

        console.warn("[MariaVoiceAgent] Maria error", error);
        setAssistantNote(message);
        appendConversationMessage("assistant", message, "Maria");
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
        (error instanceof MariaVoiceAgentError && error.code === "voice_agent_disconnected")
      ) {
        mariaStopRequestedRef.current = false;
        setIsMariaActive(false);
        setAssistantNote("Maria disconnected.");
        appendConversationMessage("system", "Maria disconnected.", "Session");
        setStatus("Disconnected");
        setIsBusy(false);
        return;
      }

      const fallbackToTranscription = shouldFallbackToTranscription(error);
      const message = getMariaVoiceAgentFailureMessage(error);

      console.warn("[MariaVoiceAgent] Maria failed to start", error);
      if (voiceAgentSessionRef.current === session) {
        voiceAgentSessionRef.current = null;
      }
      setIsMariaActive(false);
      await session.stop().catch(() => undefined);
      setAssistantNote(message);
      appendConversationMessage("assistant", message, "Maria");
      setStatus("Voice Agent unavailable");
      setIsBusy(false);

      if (fallbackToTranscription) {
        setAssistantNote("Voice Agent unavailable. Falling back to transcription.");
        appendConversationMessage("system", "Voice Agent unavailable. Falling back to transcription.", "Session");
        void startVoiceRecording();
      }
    }
  };

  const finishVoiceRecording = async (blob: Blob, metadata: LocalVoiceDebugMetadata) => {
    const voiceMetadata = sanitizeLocalVoiceMetadata({
      ...metadata,
      audioBytes: blob.size,
      mimeType: blob.type || metadata.mimeType,
    });

    if (!blob.size || blob.size < LOCAL_VOICE_MIN_AUDIO_BYTES) {
      console.warn("[MariaVoice] Recording too small to transcribe", voiceMetadata);
      setAssistantNote("I did not catch that.");
      appendConversationMessage("assistant", "I did not catch that.");
      setStatus("Ready");
      return;
    }

    setAssistantNote("Transcribing your voice...");
    setStatus("Transcribing");
    setIsBusy(true);

    try {
      const transcript = await transcribeWithLocalMaria(blob, {
        ...metadata,
        audioBytes: blob.size,
        mimeType: blob.type || metadata.mimeType,
      });
      if (!transcript) {
        setAssistantNote("I did not catch that.");
        appendConversationMessage("assistant", "I did not catch that.");
        setStatus("Ready");
        return;
      }

      const requestId = crypto.randomUUID();
      setInputText("");
      setLastCommand(`Voice: ${transcript}`);
      setAssistantNote(`Voice command received: ${transcript}`);
      await handleAction(transcript, requestId);
    } catch (error) {
      const message = getLocalVoiceFailureMessage(error);
      if (error instanceof LocalVoiceTranscriptionError) {
        console.warn("[MariaVoice] Transcription failed", {
          code: error.code,
          status: error.status,
          detail: error.detail,
          metadata: sanitizeLocalVoiceMetadata(error.metadata || metadata),
        });
      } else {
        console.warn("[MariaVoice] Transcription failed", error);
      }
      setAssistantNote(message);
      appendConversationMessage("assistant", message);
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
      appendConversationMessage("assistant", "Microphone unavailable.");
      setStatus("Microphone unavailable");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createAudioRecorder(stream);
      const requestId = createVoiceRequestId();
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
        const metadata: LocalVoiceDebugMetadata = {
          requestId: voiceRecordingRequestIdRef.current || createVoiceRequestId(),
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
      recordingTimeoutRef.current = window.setTimeout(stopVoiceRecording, LOCAL_VOICE_MAX_RECORDING_MS);
    } catch (error) {
      const errorName = error instanceof DOMException ? error.name : "";
      const message =
        errorName === "NotAllowedError" || errorName === "PermissionDeniedError"
          ? "Microphone permission needed."
          : "Could not start microphone recording.";
      setAssistantNote(message);
      appendConversationMessage("assistant", message);
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

  // Wake-word speech recognition (listen for "hey maria <command>")
  useEffect(() => {
    const SpeechRecognition = getSpeechRecognitionConstructor();
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

        rec.onresult = (e) => {
          try {
            wakeRecognitionFailureCountRef.current = 0;
            const transcripts = Array.from({ length: e.results.length }, (_, index) => e.results[index])
              .map((result) => result?.[0]?.transcript || "")
              .join(" ")
              .trim();
            const wakeIndex = transcripts.toLowerCase().lastIndexOf("hey maria");
            if (wakeIndex !== -1) {
              const cmd = transcripts.slice(wakeIndex + "hey maria".length).trim();
              if (cmd) {
                setLastCommand(`Voice: ${cmd}`);
                setAssistantNote(`Voice command received: ${cmd}`);
                void handleAction(cmd);
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

        rec.onerror = (err) => {
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
    "Fix visible issue",
  ];

  // Listen for status updates from the desktop brain bridge.
  useEffect(() => {
    const maria = getElectronBridge()?.maria;
    if (maria) {
      const unsubscribe = maria.onStatus((newStatus) => {
        const statusText = String(newStatus || "Ready");
        setStatus(statusText);
        setIsBusy(statusText !== "Ready");
        if (statusText !== "Ready") setLastCommand(statusText);
      });
      const unsubscribeEvents = maria.onAssistantEvent?.((event: MariaAssistantEvent) => {
        if (event.type === "command-started") {
          appendConversationMessage("user", event.command);
        }

        if (event.type === "command-failed") {
          const message = event.error || "Maria could not run that command.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
        }

        if (event.type === "command-stopped") {
          const message = event.message || "Maria stopped.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
        }

        if (event.type === "research-started") {
          appendConversationMessage("user", event.query);
          setAssistantNote(`Researching: ${event.query}`);
          setAssistantResults([]);
        }

        if (event.type === "research-completed") {
          const message = event.headline ? `Research complete: ${event.headline}` : "Research complete";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults(Array.isArray(event.results) ? event.results : []);
        }

        if (event.type === "scrape-completed") {
          const message = event.result?.title ? `Scraped: ${event.result.title}` : "Scrape complete";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([
            {
              title: event.result?.title || event.url,
              url: event.result?.url || event.url,
              description: event.result?.summary || "",
              summary: event.result?.summary || "",
            },
          ]);
        }

        if (event.type === "screen-analysis-started") {
          appendConversationMessage("system", "Analyzing the current screen...", "Maria");
          setAssistantNote("Analyzing the current screen...");
          setAssistantResults([]);
        }

        if (event.type === "screen-analysis-completed") {
          const message = event?.reply || "Screen analysis complete.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }

        if (event.type === "screen-analysis-failed") {
          const message = event?.message || "Maria could not capture the screen.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }

        if (event.type === "desktop-workflow-started") {
          appendConversationMessage(
            "system",
            event?.summary ? `Running desktop action: ${event.summary}` : "Running desktop action...",
            "Maria"
          );
          setAssistantNote(event?.summary ? `Running desktop action: ${event.summary}` : "Running desktop action...");
          setAssistantResults([]);
        }

        if (event.type === "desktop-workflow-completed") {
          appendConversationMessage("assistant", event?.reply || "Desktop action complete.");
          setAssistantNote(event?.reply || "Desktop action complete.");
          setAssistantResults([]);
        }

        if (event.type === "desktop-workflow-failed") {
          appendConversationMessage("assistant", event?.message || "Desktop action failed.");
          setAssistantNote(event?.message || "Desktop action failed.");
          setAssistantResults([]);
        }

        if (event.type === "assistant-reply") {
          const reply = String(event?.reply || event?.message || "Maria replied.");
          appendConversationMessage("assistant", reply);
          setAssistantNote(reply);
        }

        if (event.type === "policy-response" || event.type === "command-blocked") {
          const message = event?.message || "I can't help with that request.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }

        if (event.type === "wake-word-detected") {
          if (event.command) {
            appendConversationMessage("user", event.command);
          } else {
            appendConversationMessage("system", "Wake word detected.", "Maria");
          }
        }

        if (event.type === "calendar-check-started") {
          appendConversationMessage("user", event.command);
          setAssistantNote("Checking your calendar...");
          setAssistantResults([]);
        }

        if (event.type === "calendar-check-completed") {
          const message = event.reply || "Calendar check complete.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }

        if (event.type === "calendar-check-failed") {
          const message = event.message || "Calendar check failed.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }
      }) ?? (() => {});
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
    <div className="min-h-[calc(100vh-6rem)] w-full bg-slate-50 px-4 py-5 text-slate-950 dark:bg-black dark:text-white md:px-6">
      <div className="mx-auto flex w-full max-w-[1480px] flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 dark:border-white/10 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white shadow-lg shadow-blue-600/20">
              <MousePointer2 className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">Maria</h1>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                  <span className={`h-1.5 w-1.5 rounded-full ${isBusy ? "bg-amber-400" : "bg-emerald-400"}`} />
                  {status}
                </span>
              </div>
              <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
                A desktop command surface for voice, screen inspection, app control, and research actions.
              </p>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <MonitorCheck className="h-3.5 w-3.5" />
                Bridge
              </div>
              <div className={`mt-1 text-sm font-medium ${isBusy ? "text-amber-600 dark:text-amber-300" : "text-emerald-600 dark:text-emerald-300"}`}>
                {isBusy ? "Working" : "Ready"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Mic className="h-3.5 w-3.5" />
                Voice
              </div>
              <div className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                {isMariaActive ? "Live" : isRecording ? "Recording" : "Standby"}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.03]">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <Activity className="h-3.5 w-3.5" />
                Last action
              </div>
              <div className="mt-1 truncate text-sm font-medium text-slate-900 dark:text-white" title={lastCommand}>
                {lastCommand}
              </div>
            </div>
          </div>
        </header>

        <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_240px]">
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-[#05070d]">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                    <Command className="h-4 w-4" />
                    Command console
                  </div>
                  <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Tell Maria what to do</h2>
                </div>
                <button
                  type="button"
                  onClick={handleVoiceButton}
                  aria-pressed={isMariaActive || isRecording}
                  className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
                    isMariaActive || isRecording
                      ? "border-red-500/30 bg-red-500/10 text-red-700 hover:bg-red-500/15 dark:text-red-200"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                  }`}
                >
                  <Mic className="h-4 w-4" />
                  {isMariaActive ? "Stop Maria" : isRecording ? "Stop and send" : "Start Maria"}
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <textarea
                  className="min-h-[178px] w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-white/10 dark:bg-white/[0.04] dark:text-white dark:placeholder:text-slate-500 dark:focus:border-blue-500/60 dark:focus:bg-white/[0.06]"
                  placeholder="Click the download button, inspect the current screen, research campaign metrics..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                />

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Desktop actions can inspect the screen, move the pointer, type, scroll, and open local workflows.
                  </p>
                  <button
                    type="submit"
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-blue-600/20 transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={!inputText.trim()}
                  >
                    <SendHorizontal className="h-4 w-4" />
                    Send command
                  </button>
                </div>
              </form>
            </div>

            <aside className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-white/10 dark:bg-[#05070d] lg:auto-rows-fr">
              {quickActions.map((action, index) => {
                const icons = [ArrowUpRight, FileSearch, MonitorCheck, Sparkles];
                const ActionIcon = icons[index] ?? Command;

                return (
                  <button
                    key={action}
                    type="button"
                    className="group flex min-h-24 flex-col justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 text-left text-sm text-slate-800 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-200 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                    onClick={() => (action.startsWith("Research") ? void handleResearch(action) : void handleAction(action))}
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-white text-slate-600 ring-1 ring-slate-200 transition-colors group-hover:text-blue-600 dark:bg-black/30 dark:text-slate-300 dark:ring-white/10">
                      <ActionIcon className="h-4 w-4" />
                    </span>
                    <span className="leading-5">{action}</span>
                  </button>
                );
              })}
            </aside>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-[#05070d]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4 dark:border-white/10">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                  <Bot className="h-4 w-4" />
                  Assistant feed
                </div>
                <h2 className="mt-1 text-xl font-semibold text-slate-950 dark:text-white">Activity and context</h2>
              </div>
              <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-2.5 text-xs text-slate-600 dark:border-white/10 dark:text-slate-300">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Live
              </span>
            </div>

            <div className="grid gap-0 divide-y divide-slate-200 dark:divide-white/10">
              <div className="p-4">
                <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Conversation</div>
                <div className="mt-3 max-h-[330px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
                  {conversationMessages.length > 0 ? (
                    conversationMessages.map((message) => {
                      const isUserMessage = message.role === "user";
                      const isSystemMessage = message.role === "system";

                      return (
                        <div
                          key={message.id}
                          className={`flex ${
                            isSystemMessage ? "justify-center" : isUserMessage ? "justify-end" : "justify-start"
                          }`}
                        >
                          <div
                            className={`max-w-[90%] rounded-lg px-3 py-2 text-sm ${
                              isUserMessage
                                ? "bg-blue-600 text-white"
                                : isSystemMessage
                                  ? "border border-slate-200 bg-slate-50 text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                  : "border border-slate-200 bg-white text-slate-800 shadow-sm dark:border-white/10 dark:bg-black/30 dark:text-slate-100"
                            }`}
                          >
                            <div
                              className={`text-[11px] font-semibold uppercase ${
                                isUserMessage ? "text-blue-100" : "text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {message.speaker}
                            </div>
                            <div className="mt-1 whitespace-pre-wrap break-words leading-6">{message.text}</div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                      No conversation yet. Send a command or start Maria.
                    </div>
                  )}
                  <div ref={conversationEndRef} />
                </div>
              </div>

              <div className="p-4">
                <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Latest note</div>
                <p className="mt-2 text-sm leading-6 text-slate-800 dark:text-slate-100">{assistantNote}</p>
              </div>

              <div className="p-4">
                <div className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Results</div>

                {assistantResults.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {assistantResults.map((result) => (
                      <a
                        key={result.url || result.title}
                        href={result.url || undefined}
                        target={result.url ? "_blank" : undefined}
                        rel={result.url ? "noreferrer" : undefined}
                        className="block rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:hover:border-blue-500/40 dark:hover:bg-blue-500/10"
                      >
                        <div className="text-sm font-semibold text-slate-950 dark:text-white">{result.title}</div>
                        <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                          {result.summary || result.description}
                        </div>
                      </a>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
                    No results yet. Use research or ask Maria to inspect something.
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
