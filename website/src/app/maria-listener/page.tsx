"use client";

import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Command,
  Headphones,
  MessageSquareText,
  Mic,
  Radio,
  Radar,
  ShieldCheck,
  Volume2,
} from "lucide-react";

import { RearvyLogo } from "@/components/brand/rearvy-logo";
import { createClientLogger } from "@/lib/client-diagnostics";
import { configureMariaUtterance, warmMariaVoices } from "@/lib/maria/speech";

type MariaAssistantEvent = {
  type?: string;
  reply?: unknown;
  message?: unknown;
  origin?: unknown;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;
type ListenerTone = "booting" | "listening" | "speaking" | "error";

type MariaWindow = Window &
  typeof globalThis & {
    electron?: {
      maria?: {
        runCommand?: (command: string | { command: string; requestId?: string; origin?: string }) => Promise<unknown>;
        wakeDetected?: (payload?: { transcript?: string; command?: string; requestId?: string; origin?: string }) => void;
        onAssistantEvent?: (callback: (event: MariaAssistantEvent) => void) => () => void;
      };
    };
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const log = createClientLogger("MariaListener");
const waveformLevels = [0.42, 0.78, 1, 0.68, 0.5] as const;
const voiceExamples = [
  "Open the campaign folder and summarize the latest note.",
  "Inspect my screen and tell me what needs attention.",
] as const;
const listenerFlow = [
  { label: "Capture", detail: "Wake phrase", icon: Mic },
  { label: "Dispatch", detail: "Desktop bridge", icon: Command },
  { label: "Reply", detail: "Spoken answer", icon: Volume2 },
] as const;
const readinessChecklist = [
  {
    label: "Desktop app open",
    detail: "The listener can only dispatch work when the Rearvy Desktop bridge is available.",
    icon: ShieldCheck,
  },
  {
    label: "Microphone allowed",
    detail: "Browser speech recognition needs microphone permission for the wake phrase.",
    icon: Mic,
  },
  {
    label: "Command after wake",
    detail: 'Say "hey Maria" and continue with the task in the same sentence.',
    icon: Command,
  },
] as const;

function getMariaWindow() {
  return window as MariaWindow;
}

function getSpeechRecognition() {
  const mariaWindow = getMariaWindow();
  return mariaWindow.SpeechRecognition ?? mariaWindow.webkitSpeechRecognition;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTranscript(event: unknown) {
  const results = Array.from((event as { results?: ArrayLike<ArrayLike<{ transcript?: string }>> })?.results || []);

  return results
    .map((result) => result?.[0]?.transcript || "")
    .join(" ")
    .trim();
}

function getSpeechRecognitionErrorCode(event: unknown) {
  if (isRecord(event)) {
    const error = event.error;
    return typeof error === "string" && error.trim() ? error : "unknown";
  }

  return "unknown";
}

function getAssistantReply(event: MariaAssistantEvent) {
  if (event.type !== "assistant-reply") {
    return "";
  }

  if (typeof event.origin === "string" && event.origin && event.origin !== "wake-listener") {
    return "";
  }

  const reply = typeof event.reply === "string" ? event.reply : event.message;
  return typeof reply === "string" ? reply.trim() : "";
}

function ignoreExpectedMariaListenerError(error: unknown) {
  void error;
}

export default function MariaListenerPage() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppedRef = useRef(false);
  const speakingRef = useRef(false);
  const lastCommandRef = useRef<string>("");
  const lastSpokenReplyRef = useRef<string>("");
  const recognitionErrorCountRef = useRef(0);
  const restartRecognitionRef = useRef<(() => void) | null>(null);
  const restartTimerRef = useRef<number | null>(null);
  const [listenerStatus, setListenerStatus] = useState("Preparing wake listener");
  const [listenerTone, setListenerTone] = useState<ListenerTone>("booting");
  const [bridgeStatus, setBridgeStatus] = useState("Checking desktop bridge");
  const [lastHeard, setLastHeard] = useState("Waiting for wake word");
  const [lastReply, setLastReply] = useState("Maria replies will appear here.");

  useEffect(() => {
    const stopRecognition = () => {
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        ignoreExpectedMariaListenerError(error);
      }

      recognitionRef.current = null;
    };

    const scheduleRecognitionRestart = (delayMs = 250) => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!stoppedRef.current && !speakingRef.current) {
          restartRecognitionRef.current?.();
        }
      }, delayMs);
    };

    const speak = (reply: string) => {
      const text = reply.trim();
      if (!text || typeof window.speechSynthesis === "undefined" || typeof SpeechSynthesisUtterance === "undefined") {
        setListenerStatus("Speech output unavailable");
        setListenerTone("error");
        return;
      }

      if (text === lastSpokenReplyRef.current) {
        return;
      }

      lastSpokenReplyRef.current = text;
      speakingRef.current = true;
      setLastReply(text);
      setListenerStatus("Maria speaking");
      setListenerTone("speaking");
      stopRecognition();

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      configureMariaUtterance(utterance);

      utterance.onend = () => {
        speakingRef.current = false;
        setListenerStatus("Listening for hey Maria");
        setListenerTone("listening");
        scheduleRecognitionRestart();
      };

      utterance.onerror = () => {
        speakingRef.current = false;
        setListenerStatus("Speech output stopped");
        setListenerTone("error");
        scheduleRecognitionRestart();
      };

      window.speechSynthesis.speak(utterance);
    };

    const unsubscribe = getMariaWindow().electron?.maria?.onAssistantEvent?.((event) => {
      const reply = getAssistantReply(event);
      if (reply) {
        speak(reply);
      }
    });
    setBridgeStatus(getMariaWindow().electron?.maria ? "Desktop bridge connected" : "Desktop bridge unavailable");
    warmMariaVoices();

    return () => {
      unsubscribe?.();
      window.speechSynthesis?.cancel();
      speakingRef.current = false;
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    stoppedRef.current = false;

    const SpeechRecognition = getSpeechRecognition();
    if (!SpeechRecognition) {
      log.warn("Speech recognition is not available in this runtime.");
      setListenerStatus("Speech recognition unavailable");
      setListenerTone("error");
      return;
    }

    const scheduleRecognitionRestart = (delayMs = 250) => {
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
      }

      restartTimerRef.current = window.setTimeout(() => {
        restartTimerRef.current = null;
        if (!stoppedRef.current && !speakingRef.current) {
          restartRecognitionRef.current?.();
        }
      }, delayMs);
    };

    const disableRecognition = (reason: string) => {
      stoppedRef.current = true;
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        ignoreExpectedMariaListenerError(error);
      }
      recognitionRef.current = null;
      log.warn("Wake recognition unavailable:", reason);
      setListenerStatus(`Wake recognition unavailable: ${reason}`);
      setListenerTone("error");
    };

    const runCommand = async (command: string, requestId = crypto.randomUUID()) => {
      try {
        const trimmed = command.trim();
        if (!trimmed) return;
        if (trimmed === lastCommandRef.current) return;
        lastCommandRef.current = trimmed;

        const maria = getMariaWindow().electron?.maria;
        if (!maria?.runCommand) {
          log.warn("Maria bridge is unavailable.");
          setBridgeStatus("Desktop bridge unavailable");
          setListenerStatus("Open in Rearvy Desktop to dispatch commands");
          setListenerTone("error");
          return;
        }

        if (process.env.NODE_ENV !== "production") {
          log.debug("Dispatching wake command", {
            requestId,
            commandLength: trimmed.length,
          });
        }
        setListenerStatus("Dispatching Maria command");
        setListenerTone("booting");
        await maria.runCommand({
          command: trimmed,
          requestId,
          origin: "wake-listener",
        });
        setListenerStatus("Waiting for Maria response");
      } catch (error) {
        log.error("Failed to dispatch wake command:", error);
        setListenerStatus("Maria command dispatch failed");
        setListenerTone("error");
      }
    };

    const emitWakeDetected = (transcript: string, command: string, requestId = crypto.randomUUID()) => {
      getMariaWindow().electron?.maria?.wakeDetected?.({
        transcript,
        command,
        requestId,
        origin: "wake-listener",
      });

      return requestId;
    };

    const startRecognition = () => {
      if (stoppedRef.current || speakingRef.current || recognitionRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: unknown) => {
          try {
            recognitionErrorCountRef.current = 0;
            const transcript = readTranscript(event);
            if (!transcript) return;

            const normalized = transcript.toLowerCase();
            const wakeIndex = normalized.lastIndexOf("hey maria");
            if (wakeIndex === -1) return;

            const command = transcript.slice(wakeIndex + "hey maria".length).replace(/^[,.:;!?\-\s]+/, "").trim();
            setLastHeard(command || "Wake word detected");
            setListenerStatus(command ? "Wake command heard" : "Wake word detected");
            const requestId = emitWakeDetected(transcript, command);
            if (!command) return;

            void runCommand(command, requestId);
          } catch (error) {
            log.error("Failed to process speech result:", error);
          }
        };

        recognition.onerror = (event: unknown) => {
          const errorCode = getSpeechRecognitionErrorCode(event);
          recognitionRef.current = null;

          if (errorCode === "no-speech") {
            setListenerStatus("Listening for hey Maria");
            setListenerTone("listening");
            scheduleRecognitionRestart(1000);
            return;
          }

          if (errorCode === "aborted" || errorCode === "network") {
            recognitionErrorCountRef.current += 1;
            if (recognitionErrorCountRef.current >= 3) {
              disableRecognition(errorCode);
            } else {
              scheduleRecognitionRestart(1000);
            }
            setListenerStatus("Restarting wake listener");
            return;
          }

          if (errorCode === "not-allowed" || errorCode === "service-not-allowed" || errorCode === "audio-capture") {
            disableRecognition(errorCode);
            return;
          }

          log.warn("Recognition error:", errorCode);
          setListenerStatus(`Recognition error: ${errorCode}`);
          recognitionErrorCountRef.current += 1;
          if (recognitionErrorCountRef.current >= 3 && !speakingRef.current) {
            disableRecognition(errorCode);
            return;
          }
          scheduleRecognitionRestart(1000);
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          if (!stoppedRef.current && !speakingRef.current) {
            scheduleRecognitionRestart(250);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
        setListenerStatus("Listening for hey Maria");
        setListenerTone("listening");
      } catch (error) {
        recognitionRef.current = null;
        log.error("Failed to start recognition:", error);
        setListenerStatus("Failed to start wake listener");
        setListenerTone("error");
        recognitionErrorCountRef.current += 1;
        if (recognitionErrorCountRef.current >= 3) {
          disableRecognition("start-failed");
        } else if (!stoppedRef.current && !speakingRef.current) {
          scheduleRecognitionRestart(1000);
        }
      }
    };

    restartRecognitionRef.current = startRecognition;

    startRecognition();

    return () => {
      stoppedRef.current = true;
      restartRecognitionRef.current = null;
      if (restartTimerRef.current) {
        window.clearTimeout(restartTimerRef.current);
        restartTimerRef.current = null;
      }
      try {
        recognitionRef.current?.stop?.();
      } catch (error) {
        ignoreExpectedMariaListenerError(error);
      }
      recognitionRef.current = null;
    };
  }, []);

  const toneClass =
    listenerTone === "listening"
      ? "border-emerald-300/24 bg-emerald-300/10 text-emerald-100"
      : listenerTone === "speaking"
        ? "border-cyan-300/24 bg-cyan-300/10 text-cyan-100"
        : listenerTone === "error"
          ? "border-red-300/24 bg-red-400/10 text-red-100"
          : "border-amber-300/24 bg-amber-300/10 text-amber-100";
  const isListening = listenerTone === "listening";

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#071018] px-5 py-6 text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80 [background-image:linear-gradient(135deg,rgba(14,165,233,0.16),rgba(7,16,24,0)_34%),linear-gradient(315deg,rgba(16,185,129,0.12),rgba(7,16,24,0)_32%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.18] [background-image:linear-gradient(rgba(255,255,255,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.12)_1px,transparent_1px)] [background-size:44px_44px]" />

      <div className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between gap-4">
          <RearvyLogo priority markSize={38} markClassName="h-10 w-10" textClassName="text-xl text-white" />
          <span className={`inline-flex max-w-[58vw] items-center gap-2 rounded-[8px] border px-3 py-1 text-xs font-semibold ${toneClass}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${listenerTone === "listening" ? "animate-pulse bg-emerald-300" : "bg-current"}`} />
            <span className="truncate">{listenerStatus}</span>
          </span>
        </header>

        <section className="grid flex-1 items-center gap-6 py-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(360px,0.7fr)]">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-[8px] border border-white/12 bg-white/[0.07] px-3 py-1 text-xs font-medium text-white/68">
              <Radio className="h-3.5 w-3.5 text-cyan-200" />
              Maria wake listener
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-white sm:text-7xl">
              Listening for desktop voice commands.
            </h1>
            <p className="mt-5 max-w-xl text-base font-medium leading-7 text-white/64">
              Keep this bridge open in Rearvy Desktop to catch "hey Maria" commands, dispatch them to the desktop assistant, and speak the response back.
            </p>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              {voiceExamples.map((example, index) => (
                <div
                  key={example}
                  className="grid min-h-[104px] grid-cols-[38px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.055] p-3 shadow-sm shadow-black/15 backdrop-blur-xl"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/10 text-cyan-100">
                    {index === 0 ? (
                      <MessageSquareText className="h-4 w-4" aria-hidden />
                    ) : (
                      <Radar className="h-4 w-4" aria-hidden />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-white/56">Try saying</p>
                    <p className="mt-1 text-sm leading-6 text-white/78">
                      "hey Maria, {example}"
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-[8px] border border-white/12 bg-black/55 p-4 shadow-sm shadow-black/25 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
                  <Mic className="h-3.5 w-3.5" />
                  Listener status
                </div>
                <p className="mt-2 text-xl font-semibold leading-tight text-white">{listenerStatus}</p>
              </div>
              <div className={`flex h-12 w-12 items-center justify-center rounded-[8px] border ${toneClass}`}>
                <Activity className="h-5 w-5" />
              </div>
            </div>

            <div className="grid gap-3 py-4">
              {[
                { label: "Bridge", value: bridgeStatus, icon: ShieldCheck },
                { label: "Last heard", value: lastHeard, icon: Command },
                { label: "Last reply", value: lastReply, icon: Volume2 },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.label} className="grid grid-cols-[40px_minmax(0,1fr)] gap-3 rounded-[8px] border border-white/10 bg-white/[0.06] p-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white/58">{item.label}</p>
                      <p className="mt-1 break-words text-sm leading-6 text-white/78">{item.value}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mb-3 rounded-[8px] border border-white/10 bg-white/[0.045] p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Headphones className="h-4 w-4 text-[#7de7c7]" aria-hidden />
                  Voice signal
                </div>
                <span className="text-xs font-medium text-white/58">
                  {isListening ? "Armed" : "Standby"}
                </span>
              </div>
              <div
                className="mt-4 flex h-14 items-end justify-center gap-2 rounded-[8px] border border-white/10 bg-black/28 px-4 pb-3"
                aria-hidden
              >
                {waveformLevels.map((level, index) => (
                  <span
                    key={`${level}-${index}`}
                    className={
                      isListening
                        ? "w-2 rounded-full bg-[#7de7c7] shadow-[0_0_18px_rgba(125,231,199,0.5)]"
                        : "w-2 rounded-full bg-white/22"
                    }
                    style={{ height: `${Math.round(level * 36)}px` }}
                  />
                ))}
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {listenerFlow.map((step) => {
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.label}
                      className="rounded-[8px] border border-white/10 bg-black/28 p-3"
                    >
                      <Icon className="h-4 w-4 text-cyan-100" aria-hidden />
                      <p className="mt-2 text-sm font-semibold text-white">{step.label}</p>
                      <p className="mt-1 text-xs leading-5 text-white/58">{step.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 p-3 text-sm font-semibold text-cyan-50">
              Say "hey Maria" followed by a desktop task.
            </div>
          </div>

          <div className="rounded-[8px] border border-white/12 bg-white/[0.055] p-4 shadow-sm shadow-black/20 backdrop-blur-xl lg:col-span-2">
            <div className="grid gap-4 lg:grid-cols-[0.64fr_1.36fr] lg:items-center">
              <div>
                <div className="flex items-center gap-2 text-xs font-medium text-cyan-100/74">
                  <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                  Desktop readiness
                </div>
                <h2 className="mt-2 text-2xl font-semibold leading-tight text-white">
                  Keep the voice bridge predictable before giving Maria work.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-white/64">
                  These checks keep the listener honest: browser capture, desktop
                  dispatch, and spoken response each have a clear boundary.
                </p>
              </div>

              <div className="grid gap-3 md:grid-cols-3">
                {readinessChecklist.map((item) => {
                  const Icon = item.icon;

                  return (
                    <div
                      key={item.label}
                      className="min-w-0 rounded-[8px] border border-white/10 bg-black/28 p-4"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-cyan-200/18 bg-cyan-200/10 text-cyan-100">
                        <Icon className="h-4 w-4" aria-hidden />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-white">{item.label}</p>
                      <p className="mt-2 text-xs leading-5 text-white/62">{item.detail}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
