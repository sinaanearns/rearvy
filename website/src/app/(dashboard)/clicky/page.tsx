"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MousePointer2, Play } from "lucide-react";
import {
  ClickyVoiceAgentError,
  ClickyVoiceAgentSession,
  getClickyVoiceAgentFailureMessage,
  type ClickyVoiceAgentStatus,
  type ClickyVoiceAgentToolRequest,
  type ClickyVoiceAgentToolResult,
} from "@/lib/clicky/voice-agent";
import {
  LOCAL_VOICE_MAX_RECORDING_MS,
  LOCAL_VOICE_MIN_AUDIO_BYTES,
  LocalVoiceTranscriptionError,
  createAudioRecorder,
  createVoiceRequestId,
  getLocalVoiceFailureMessage,
  sanitizeLocalVoiceMetadata,
  transcribeWithLocalClicky,
  type LocalVoiceDebugMetadata,
} from "@/lib/clicky/local-transcription";
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

type ClickyConversationRole = "user" | "assistant" | "system";

type ClickyConversationMessage = {
  id: string;
  role: ClickyConversationRole;
  speaker: string;
  text: string;
};

type ClickySpeechRecognitionEvent = {
  results: ArrayLike<{ [index: number]: { transcript?: string } | undefined }>;
};

type ClickySpeechRecognitionErrorEvent = {
  error?: string;
  message?: string;
  type?: string;
};

type ClickySpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: ClickySpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: ClickySpeechRecognitionErrorEvent) => void) | null;
  start: () => void;
  stop: () => void;
};

type ClickySpeechRecognitionConstructor = new () => ClickySpeechRecognition;

const CLICKY_PAGE_ORIGIN = "clicky-page";

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
    SpeechRecognition?: ClickySpeechRecognitionConstructor;
    webkitSpeechRecognition?: ClickySpeechRecognitionConstructor;
  };

  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition ?? null;
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
  const [conversationMessages, setConversationMessages] = useState<ClickyConversationMessage[]>([]);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<ClickySpeechRecognition | null>(null);
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
  const conversationEndRef = useRef<HTMLDivElement | null>(null);

  const appendConversationMessage = useCallback(
    (role: ClickyConversationRole, text: unknown, speaker = role === "user" ? "You" : "Clicky") => {
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
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
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
      const clicky = getElectronBridge()?.clicky;
      if (clicky?.runCommand) {
        const result = await clicky.runCommand(createClickyPayload(command, requestId));
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
      console.error("Failed to run clicky command:", err);
      appendConversationMessage("assistant", "Clicky could not run that command.");
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
      const clicky = getElectronBridge()?.clicky;
      if (isScreenAnalysisRequest(query) && clicky?.runCommand) {
        const result = await clicky.runCommand(createClickyPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          appendConversationMessage("assistant", reply);
          setAssistantNote(reply);
        }
        return;
      }

      if (clicky?.research) {
        const result = await clicky.research(createClickyPayload(query, requestId));
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
      console.error("Failed to research with clicky:", err);
      appendConversationMessage("assistant", "Clicky could not finish the research request.");
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const applyMariaStatus = (nextStatus: ClickyVoiceAgentStatus) => {
    setStatus(nextStatus);
    setIsBusy(
      nextStatus === "Connecting" ||
        nextStatus === "Maria thinking" ||
        nextStatus === "Maria speaking" ||
        nextStatus === "Running Clicky action"
    );
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

    appendConversationMessage("system", command, mode === "research" ? "Research action" : "Clicky action");
    setLastCommand(`Maria: ${command}`);
    setAssistantNote(`Running Clicky action: ${command}`);
    setStatus("Running Clicky action");
    setIsBusy(true);

    try {
      const clicky = getElectronBridge()?.clicky;
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
      appendConversationMessage("assistant", "Open Clicky in the desktop app to run commands.");
      return {
        ok: false,
        message: "Desktop bridge unavailable.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to run Maria Clicky tool:", error);
      setStatus("Error");
      setAssistantNote("Clicky could not run that action.");
      appendConversationMessage("assistant", "Clicky could not run that action.");
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

        return await runMariaClickyTool(request);
      },
      onError: (message, error) => {
        if (!isCurrentMariaSession()) {
          return;
        }

        console.warn("[ClickyVoiceAgent] Maria error", error);
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
        (error instanceof ClickyVoiceAgentError && error.code === "voice_agent_disconnected")
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
      const message = getClickyVoiceAgentFailureMessage(error);

      console.warn("[ClickyVoiceAgent] Maria failed to start", error);
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
      console.warn("[ClickyVoice] Recording too small to transcribe", voiceMetadata);
      setAssistantNote("I did not catch that.");
      appendConversationMessage("assistant", "I did not catch that.");
      setStatus("Ready");
      return;
    }

    setAssistantNote("Transcribing your voice...");
    setStatus("Transcribing");
    setIsBusy(true);

    try {
      const transcript = await transcribeWithLocalClicky(blob, {
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
        console.warn("[ClickyVoice] Transcription failed", {
          code: error.code,
          status: error.status,
          detail: error.detail,
          metadata: sanitizeLocalVoiceMetadata(error.metadata || metadata),
        });
      } else {
        console.warn("[ClickyVoice] Transcription failed", error);
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

  // Wake-word speech recognition (listen for "hey clicky <command>")
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
            const wakeIndex = transcripts.toLowerCase().lastIndexOf("hey clicky");
            if (wakeIndex !== -1) {
              const cmd = transcripts.slice(wakeIndex + "hey clicky".length).trim();
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
    const clicky = getElectronBridge()?.clicky;
    if (clicky) {
      const unsubscribe = clicky.onStatus((newStatus) => {
        const statusText = String(newStatus || "Ready");
        setStatus(statusText);
        setIsBusy(statusText !== "Ready");
        if (statusText !== "Ready") setLastCommand(statusText);
      });
      const unsubscribeEvents = clicky.onAssistantEvent?.((event: ClickyAssistantEvent) => {
        if (event.type === "command-started") {
          appendConversationMessage("user", event.command);
        }

        if (event.type === "command-failed") {
          const message = event.error || "Clicky could not run that command.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
        }

        if (event.type === "command-stopped") {
          const message = event.message || "Clicky stopped.";
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
          appendConversationMessage("system", "Analyzing the current screen...", "Clicky");
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
          const message = event?.message || "Clicky could not capture the screen.";
          appendConversationMessage("assistant", message);
          setAssistantNote(message);
          setAssistantResults([]);
        }

        if (event.type === "desktop-workflow-started") {
          appendConversationMessage(
            "system",
            event?.summary ? `Running desktop action: ${event.summary}` : "Running desktop action...",
            "Clicky"
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
          const reply = String(event?.reply || event?.message || "Clicky replied.");
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
            appendConversationMessage("system", "Wake word detected.", "Clicky");
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
              Full typed and spoken conversation, plus any research or workbook context Clicky returns.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Conversation
            </div>
            <div className="mt-3 max-h-[360px] space-y-3 overflow-y-auto pr-1" aria-live="polite">
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
                        className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                          isUserMessage
                            ? "bg-blue-600 text-white"
                            : isSystemMessage
                              ? "border border-slate-200 bg-white text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
                              : "border border-slate-200 bg-white text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                        }`}
                      >
                        <div
                          className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${
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
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  No conversation yet. Send a command or start Maria.
                </div>
              )}
              <div ref={conversationEndRef} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Latest note
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
