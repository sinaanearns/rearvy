"use client";

import { useEffect, useRef } from "react";
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

function getMariaWindow() {
  return window as MariaWindow;
}

function getSpeechRecognition() {
  const mariaWindow = getMariaWindow();
  return mariaWindow.SpeechRecognition ?? mariaWindow.webkitSpeechRecognition;
}

function readTranscript(event: unknown) {
  const results = Array.from((event as { results?: ArrayLike<ArrayLike<{ transcript?: string }>> })?.results || []);

  return results
    .map((result) => result?.[0]?.transcript || "")
    .join(" ")
    .trim();
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

export default function MariaListenerPage() {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const stoppedRef = useRef(false);
  const speakingRef = useRef(false);
  const lastCommandRef = useRef<string>("");
  const lastSpokenReplyRef = useRef<string>("");
  const recognitionErrorCountRef = useRef(0);
  const restartRecognitionRef = useRef<(() => void) | null>(null);
  const restartTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const stopRecognition = () => {
      try {
        recognitionRef.current?.stop();
      } catch {}

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
        return;
      }

      if (text === lastSpokenReplyRef.current) {
        return;
      }

      lastSpokenReplyRef.current = text;
      speakingRef.current = true;
      stopRecognition();

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      configureMariaUtterance(utterance);

      utterance.onend = () => {
        speakingRef.current = false;
        scheduleRecognitionRestart();
      };

      utterance.onerror = () => {
        speakingRef.current = false;
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
      console.warn("[MariaListener] Speech recognition is not available in this runtime.");
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
      } catch {}
      recognitionRef.current = null;
      console.warn("[MariaListener] Wake recognition unavailable:", reason);
    };

    const runCommand = async (command: string, requestId = crypto.randomUUID()) => {
      try {
        const trimmed = command.trim();
        if (!trimmed) return;
        if (trimmed === lastCommandRef.current) return;
        lastCommandRef.current = trimmed;

        const maria = getMariaWindow().electron?.maria;
        if (!maria?.runCommand) {
          console.warn("[MariaListener] Maria bridge is unavailable.");
          return;
        }

        console.log("[MariaListener] Wake command:", trimmed);
        await maria.runCommand({
          command: trimmed,
          requestId,
          origin: "wake-listener",
        });
      } catch (error) {
        console.error("[MariaListener] Failed to dispatch wake command:", error);
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
            const requestId = emitWakeDetected(transcript, command);
            if (!command) return;

            void runCommand(command, requestId);
          } catch (error) {
            console.error("[MariaListener] Failed to process speech result:", error);
          }
        };

        recognition.onerror = (event: unknown) => {
          const error = event as { error?: unknown };
          const errorCode = typeof error?.error === "string" ? error.error : "unknown";
          recognitionRef.current = null;

          if (errorCode === "no-speech") {
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
            return;
          }

          if (errorCode === "not-allowed" || errorCode === "service-not-allowed" || errorCode === "audio-capture") {
            disableRecognition(errorCode);
            return;
          }

          console.warn("[MariaListener] Recognition error:", errorCode);
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
      } catch (error) {
        recognitionRef.current = null;
        console.error("[MariaListener] Failed to start recognition:", error);
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
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  return null;
}
