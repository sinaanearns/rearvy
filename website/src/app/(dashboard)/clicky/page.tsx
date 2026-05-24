"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MousePointer2, Play, Search, Sparkles } from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";

type ClickyResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type ClickyCommandPayload = {
  command: string;
  requestId: string;
  origin: "clicky-page";
};

type ClickyCommandResult = {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
};

const MAX_VOICE_RECORDING_MS = 10000;
const CLICKY_PAGE_ORIGIN = "clicky-page";

function createClickyPayload(command: string, requestId = crypto.randomUUID()): ClickyCommandPayload {
  return {
    command,
    requestId,
    origin: CLICKY_PAGE_ORIGIN,
  };
}

function readReplyText(value: unknown) {
  if (!value || typeof value !== "object") {
    return "";
  }

  const result = value as ClickyCommandResult;
  return String(result.reply || result.message || "").trim();
}

function createAudioRecorder(stream: MediaStream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("media-recorder-unavailable");
  }

  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return new MediaRecorder(stream, { mimeType: "audio/webm" });
  }

  return new MediaRecorder(stream);
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

function speakText(text: string) {
  const reply = text.trim();
  if (
    !reply ||
    typeof window === "undefined" ||
    !window.speechSynthesis ||
    typeof SpeechSynthesisUtterance === "undefined"
  ) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(reply);
  utterance.rate = 1.05;
  utterance.pitch = 1;
  window.speechSynthesis.speak(utterance);
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
  const lastSpokenRequestIdRef = useRef("");
  const wakeRecognitionFailureCountRef = useRef(0);

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

  const speakReplyOnce = (reply: string, requestId?: string) => {
    if (requestId && lastSpokenRequestIdRef.current === requestId) {
      return;
    }

    if (requestId) {
      lastSpokenRequestIdRef.current = requestId;
    }

    speakText(reply);
  };

  const getLocalClickyTranscriptionUrl = async () => {
    const port = await (window as any).electron?.localApiPort?.().catch(() => null);
    const localApiPort = typeof port === "number" && Number.isFinite(port) ? port : 4000;
    return `http://127.0.0.1:${localApiPort}/api/internal/clicky/transcribe`;
  };

  const transcribeAudio = async (blob: Blob) => {
    const audio = await blobToBase64(blob);
    if (!audio) {
      return "";
    }

    let response: Response;
    try {
      response = await fetch(await getLocalClickyTranscriptionUrl(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audio, contentType: blob.type || "audio/webm" }),
      });
    } catch {
      throw new Error("voice-transcription-unavailable");
    }

    let payload: any = null;
    try {
      payload = await response.json();
    } catch {}

    if (response.status === 501) {
      throw new Error("voice-transcription-unavailable");
    }

    if (!response.ok) {
      throw new Error(payload?.error || "voice-transcription-failed");
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
          speakReplyOnce(reply, requestId);
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
      if ((window as any).electron?.clicky?.research) {
        const result = await (window as any).electron.clicky.research(createClickyPayload(query, requestId));
        const reply = readReplyText(result);
        if (reply) {
          speakReplyOnce(reply, requestId);
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

  const finishVoiceRecording = async (blob: Blob) => {
    if (!blob.size) {
      setAssistantNote("I did not catch that.");
      setStatus("Ready");
      return;
    }

    setAssistantNote("Transcribing your voice...");
    setStatus("Transcribing");
    setIsBusy(true);

    try {
      const transcript = await transcribeAudio(blob);
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
      const message =
        error instanceof Error && error.message === "voice-transcription-unavailable"
          ? "Voice transcription is unavailable."
          : "I could not transcribe that.";
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
      window.speechSynthesis?.cancel();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = createAudioRecorder(stream);
      audioChunksRef.current = [];
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        clearRecordingTimeout();
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        audioChunksRef.current = [];
        mediaRecorderRef.current = null;
        setIsRecording(false);
        stopRecordingTracks();
        void finishVoiceRecording(blob);
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
      stopRecordingTracks();
    }
  };

  const handleVoiceButton = () => {
    if (isRecording) {
      setAssistantNote("Sending voice command...");
      setStatus("Processing voice");
      stopVoiceRecording();
      return;
    }

    void startVoiceRecording();
  };

  useEffect(() => {
    return () => {
      if (recordingTimeoutRef.current !== null) {
        window.clearTimeout(recordingTimeoutRef.current);
        recordingTimeoutRef.current = null;
      }
      try {
        if (mediaRecorderRef.current?.state !== "inactive") {
          mediaRecorderRef.current?.stop();
        }
      } catch {}
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      window.speechSynthesis?.cancel();
    };
  }, []);

  // Wake-word speech recognition (listen for "hey clicky <command>")
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !allowWake) {
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

    const disableWakeRecognition = (nextStatus: string) => {
      mounted = false;
      setAllowWake(false);
      setStatus(nextStatus);
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };

    const startRecognition = () => {
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
          if (allowWake && mounted) {
            try {
              rec.start();
            } catch {}
          }
        };

        rec.onerror = (err: any) => {
          const errorCode = getSpeechRecognitionErrorCode(err);

          if (errorCode === "no-speech") {
            setStatus("Listening");
            return;
          }

          if (errorCode === "aborted" || errorCode === "network") {
            wakeRecognitionFailureCountRef.current += 1;
            if (wakeRecognitionFailureCountRef.current >= 3) {
              console.warn("Speech recognition unavailable", errorCode);
              disableWakeRecognition("Wakeword unavailable");
            } else {
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
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
    };
  }, [allowWake]);

  const quickActions = [
    "Open Shopify dashboard",
    "Research latest campaign metrics",
    "Summarize what is on this screen",
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

        if (event?.type === "assistant-reply") {
          const reply = String(event?.reply || event?.message || "Clicky replied.");
          setAssistantNote(reply);
          if (event?.origin === CLICKY_PAGE_ORIGIN) {
            speakReplyOnce(reply, String(event?.requestId || ""));
          }
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
            {allowWake ? "Wake word enabled" : "Wake word disabled"}
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
                Type a command, use a quick action, or speak to Clicky while this page is open.
              </p>
            </div>
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                allowWake
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
              onClick={() => setAllowWake((current) => !current)}
              aria-pressed={allowWake}
            >
              <Mic className="h-4 w-4" />
              {allowWake ? "Disable wake word" : "Enable wake word"}
            </button>
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
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleAction("Open Shopify dashboard")}
              >
                <Sparkles className="h-4 w-4" />
                Quick open
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleResearch("Research latest campaign metrics")}
              >
                <Search className="h-4 w-4" />
                Quick research
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
            aria-pressed={isRecording}
            className={`inline-flex items-center gap-2 rounded-full border border-dashed px-4 py-2 text-sm transition-colors ${
              isRecording
                ? "border-red-300 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200"
                : "border-slate-300 text-slate-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
            }`}
          >
            <Mic className="h-4 w-4" />
            {isRecording ? "Stop and send" : "Speak to Clicky"}
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
