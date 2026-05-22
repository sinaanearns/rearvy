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
        let errorCount = 0;
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
          errorCount = (errorCount || 0) + 1;
          // If SpeechRecognition repeatedly fails, use short media recording fallback
          if (errorCount >= 3) {
            void doMediaRecorderFallback();
            errorCount = 0;
          }
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

    async function doMediaRecorderFallback() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          console.warn("[ClickyListener] MediaRecorder not available in this runtime.");
          return;
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
        const chunks: BlobPart[] = [];

        recorder.ondataavailable = (ev) => {
          if (ev.data && ev.data.size) chunks.push(ev.data);
        };

        const stopped = new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
        });

        recorder.start();
        // record a short clip
        setTimeout(() => recorder.stop(), 3000);
        await stopped;

        const blob = new Blob(chunks, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());

        const arrayBuffer = await blob.arrayBuffer();
        const uint8 = new Uint8Array(arrayBuffer);
        // convert to base64
        let binary = "";
        for (let i = 0; i < uint8.length; i++) {
          binary += String.fromCharCode(uint8[i]);
        }
        const base64 = btoa(binary);

        // POST to local API which proxies to AssemblyAI
        const localApiBase = (window as any).__REARVY_LOCAL_API_ORIGIN || `${location.protocol}//${location.hostname}:${location.port || 3000}`;
        const endpoints = [
          `${localApiBase.replace(/:\\d+$/, ":4000")}/api/internal/clicky/transcribe`,
          `/api/internal/clicky/transcribe`,
        ];

        let transcriptText = "";
        for (const url of endpoints) {
          try {
            const res = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio: base64, contentType: blob.type }),
            });

            if (!res.ok) continue;
            const json = await res.json();
            if (json && json.text) {
              transcriptText = String(json.text || "");
              break;
            }
          } catch (err) {
            // try next
          }
        }

        if (transcriptText) {
          const clicky = (window as any).electron?.clicky;
          if (clicky?.runCommand) {
            void clicky.runCommand(transcriptText);
          } else {
            console.warn("[ClickyListener] Clicky bridge unavailable for fallback transcript");
          }
        }
      } catch (err) {
        console.error("[ClickyListener] MediaRecorder fallback failed:", err);
      }
    }

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
