"use client";

import { useEffect, useRef } from "react";

export default function ClickyListenerPage() {
  const recognitionRef = useRef<any | null>(null);
  const stoppedRef = useRef(false);
  const lastCommandRef = useRef<string>("");

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn("[ClickyListener] Speech recognition is not available in this runtime.");
      return;
    }

    const runCommand = async (command: string) => {
      try {
        const trimmed = command.trim();
        if (!trimmed) return;
        if (trimmed === lastCommandRef.current) return;
        lastCommandRef.current = trimmed;

        const clicky = (window as any).electron?.clicky;
        if (!clicky?.runCommand) {
          console.warn("[ClickyListener] Clicky bridge is unavailable.");
          return;
        }

        console.log("[ClickyListener] Wake command:", trimmed);
        await clicky.runCommand(trimmed);
      } catch (error) {
        console.error("[ClickyListener] Failed to dispatch wake command:", error);
      }
    };

    const startRecognition = () => {
      if (stoppedRef.current) return;

      try {
        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event: any) => {
          try {
            const results = Array.from(event.results || []);
            const transcript = results
              .map((result: any) => result?.[0]?.transcript || "")
              .join(" ")
              .trim();

            if (!transcript) return;

            const normalized = transcript.toLowerCase();
            const wakeIndex = normalized.lastIndexOf("hey clicky");
            if (wakeIndex === -1) return;

            const command = transcript.slice(wakeIndex + "hey clicky".length).replace(/^[,.:;!?\-\s]+/, "").trim();
            if (!command) return;

            void runCommand(command);
          } catch (error) {
            console.error("[ClickyListener] Failed to process speech result:", error);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("[ClickyListener] Recognition error:", event?.error || event);
          if (!stoppedRef.current) {
            window.setTimeout(startRecognition, 1000);
          }
        };

        recognition.onend = () => {
          if (!stoppedRef.current) {
            window.setTimeout(startRecognition, 250);
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (error) {
        console.error("[ClickyListener] Failed to start recognition:", error);
        if (!stoppedRef.current) {
          window.setTimeout(startRecognition, 1000);
        }
      }
    };

    startRecognition();

    return () => {
      stoppedRef.current = true;
      try {
        recognitionRef.current?.stop?.();
      } catch {}
      recognitionRef.current = null;
    };
  }, []);

  return null;
}
