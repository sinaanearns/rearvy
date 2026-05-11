"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import styles from "./buddy-overlay.module.css";

// Browser Speech Recognition type declarations (prefixed API)
declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionInstance;
    webkitSpeechRecognition: new () => SpeechRecognitionInstance;
  }
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent extends Event {
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface PointerTarget {
  x: number; // 0-1 relative
  y: number; // 0-1 relative
  label: string;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

// ─── Parse [POINT:x,y:label] from AI response ────────────────────────────────
function parsePointTags(text: string): { clean: string; pointers: PointerTarget[] } {
  const pointers: PointerTarget[] = [];
  const clean = text.replace(/\[POINT:([\d.]+),([\d.]+):([^\]]+)\]/g, (_match, x, y, label) => {
    pointers.push({ x: parseFloat(x), y: parseFloat(y), label });
    return "";
  }).trim();
  return { clean, pointers };
}


function useSpeechRecognition(onResult: (text: string) => void) {
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const [listening, setListening] = useState(false);

  const startListening = useCallback(() => {
    const SpeechRecognitionCtor =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognition.start();
    recognitionRef.current = recognition;
    setListening(true);
  }, [onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { listening, startListening, stopListening };
}

// ─── TTS via browser SpeechSynthesis ─────────────────────────────────────────
function speakText(text: string) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.1;
  utterance.pitch = 1.0;
  // Prefer a good voice
  const voices = window.speechSynthesis.getVoices();
  const preferred = voices.find(
    (v) => v.name.includes("Google") || v.name.includes("Neural") || v.name.includes("Samantha")
  );
  if (preferred) utterance.voice = preferred;
  window.speechSynthesis.speak(utterance);
}

// ─── Screen capture ───────────────────────────────────────────────────────────
async function captureScreen(): Promise<string | null> {
  try {
    const stream = await (navigator.mediaDevices as any).getDisplayMedia({
      video: { mediaSource: "screen" },
    });
    const track = stream.getVideoTracks()[0];
    const imageCapture = new (window as any).ImageCapture(track);
    const bitmap = await imageCapture.grabFrame();
    track.stop();
    stream.getTracks().forEach((t: MediaStreamTrack) => t.stop());

    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    ctx?.drawImage(bitmap, 0, 0);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
    return dataUrl.split(",")[1]; // base64 only
  } catch {
    return null;
  }
}

// ─── Animated pointer dot ─────────────────────────────────────────────────────
function PointerDot({ pointer }: { pointer: PointerTarget | null }) {
  if (!pointer) return null;
  return (
    <div
      className={styles.pointerDot}
      style={{
        left: `${pointer.x * 100}%`,
        top: `${pointer.y * 100}%`,
      }}
    >
      <div className={styles.pointerRing} />
      <div className={styles.pointerLabel}>{pointer.label}</div>
    </div>
  );
}

// ─── Main Buddy Widget ─────────────────────────────────────────────────────────
export function BuddyWidget() {
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [activePointer, setActivePointer] = useState<PointerTarget | null>(null);
  const [position, setPosition] = useState({ x: 24, y: 80 });
  const [dragging, setDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Speech recognition
  const handleTranscript = useCallback((text: string) => {
    setInputText(text);
    setTimeout(() => sendMessage(text), 100);
  }, []);

  const { listening, startListening, stopListening } = useSpeechRecognition(handleTranscript);

  // ── Dragging logic
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setDragging(true);
    dragOffset.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  }, [position]);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y });
    };
    const onUp = () => setDragging(false);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [dragging]);

  // ── Send message to buddy API
  const sendMessage = useCallback(async (text?: string) => {
    const userText = (text ?? inputText).trim();
    if (!userText || loading) return;

    setInputText("");
    setLoading(true);
    setActivePointer(null);

    const userMsg: Message = { role: "user", content: userText };
    setMessages((prev) => [...prev, userMsg]);

    // Build conversation history for context
    const history = messages.slice(-6).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/buddy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userText,
          conversationHistory: history,
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) throw new Error("API error");

      // Stream response
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        // Parse AI SDK data stream format
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const data = JSON.parse(line.slice(2));
              if (typeof data === "string") {
                assistantText += data;
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = updated.findLastIndex((m) => m.role === "assistant");
                  if (idx >= 0) updated[idx] = { role: "assistant", content: assistantText };
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      // Parse pointer tags from final response
      const { clean, pointers } = parsePointTags(assistantText);
      if (pointers.length > 0) {
        setActivePointer(pointers[0]);
        // Clean up message text
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.findLastIndex((m) => m.role === "assistant");
          if (idx >= 0) updated[idx] = { role: "assistant", content: clean || assistantText };
          return updated;
        });
        // Auto-hide pointer after 6s
        setTimeout(() => setActivePointer(null), 6000);
      }

      // TTS
      const textToSpeak = clean || assistantText;
      if (textToSpeak) {
        setSpeaking(true);
        speakText(textToSpeak);
        setTimeout(() => setSpeaking(false), textToSpeak.length * 60);
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "⚠️ Connection error. Please try again." },
        ]);
      }
    } finally {
      setLoading(false);
    }
  }, [inputText, loading, messages]);

  // ── Screen capture + ask
  const handleScreenCapture = useCallback(async () => {
    setLoading(true);
    const base64 = await captureScreen();
    setLoading(false);
    if (!base64) return;

    const userMsg: Message = { role: "user", content: "📸 [Screenshot captured] What financial insights do you see?" };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await fetch("/api/buddy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "Analyze this screen for financial data, charts, prices, or market signals. Give me actionable insights.",
          screenshotBase64: base64,
          conversationHistory: messages.slice(-4).map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!res.ok || !res.body) throw new Error("API error");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");
        for (const line of lines) {
          if (line.startsWith("0:")) {
            try {
              const data = JSON.parse(line.slice(2));
              if (typeof data === "string") {
                assistantText += data;
                setMessages((prev) => {
                  const updated = [...prev];
                  const idx = updated.findLastIndex((m) => m.role === "assistant");
                  if (idx >= 0) updated[idx] = { role: "assistant", content: assistantText };
                  return updated;
                });
              }
            } catch { /* skip */ }
          }
        }
      }

      const { clean, pointers } = parsePointTags(assistantText);
      if (pointers.length > 0) {
        setActivePointer(pointers[0]);
        setMessages((prev) => {
          const updated = [...prev];
          const idx = updated.findLastIndex((m) => m.role === "assistant");
          if (idx >= 0) updated[idx] = { role: "assistant", content: clean || assistantText };
          return updated;
        });
        setTimeout(() => setActivePointer(null), 6000);
      }

      if (assistantText) {
        setSpeaking(true);
        speakText(clean || assistantText);
        setTimeout(() => setSpeaking(false), assistantText.length * 60);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "⚠️ Could not analyze screen." }]);
    } finally {
      setLoading(false);
    }
  }, [messages]);

  // ── Key handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // ── Global Ctrl+Shift+B to open/close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "B") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      {/* Pointer overlay — transparent full-screen */}
      {activePointer && (
        <div className={styles.pointerOverlay} aria-hidden>
          <PointerDot pointer={activePointer} />
        </div>
      )}

      {/* Floating widget */}
      <div
        className={`${styles.widget} ${open ? styles.widgetOpen : ""}`}
        style={{ left: position.x, top: position.y }}
        id="rearvy-buddy-widget"
      >
        {/* Toggle button */}
        {!open && (
          <button
            className={styles.toggleBtn}
            onClick={() => setOpen(true)}
            title="Open Rearvy Buddy (Ctrl+Shift+B)"
            id="rearvy-buddy-toggle"
          >
            <span className={`${styles.buddyPulse} ${speaking ? styles.speaking : ""}`}>
              <BuddyIcon />
            </span>
          </button>
        )}

        {open && (
          <div className={styles.panel}>
            {/* Header */}
            <div
              className={styles.header}
              onMouseDown={handleMouseDown}
              style={{ cursor: dragging ? "grabbing" : "grab" }}
            >
              <div className={styles.headerLeft}>
                <span className={`${styles.headerIcon} ${speaking ? styles.speaking : ""}`}>
                  <BuddyIcon />
                </span>
                <div>
                  <div className={styles.headerTitle}>Rearvy Buddy</div>
                  <div className={styles.headerSub}>Financial AI • Always watching</div>
                </div>
              </div>
              <div className={styles.headerActions}>
                <button
                  className={styles.headerBtn}
                  onClick={() => setMinimized((v) => !v)}
                  title={minimized ? "Expand" : "Minimize"}
                >
                  {minimized ? "▲" : "▼"}
                </button>
                <button
                  className={styles.headerBtn}
                  onClick={() => setOpen(false)}
                  title="Close (Ctrl+Shift+B)"
                >
                  ✕
                </button>
              </div>
            </div>

            {!minimized && (
              <>
                {/* Messages */}
                <div className={styles.messages} id="rearvy-buddy-messages">
                  {messages.length === 0 && (
                    <div className={styles.emptyState}>
                      <div className={styles.emptyIcon}>📊</div>
                      <div className={styles.emptyTitle}>Hey! I&apos;m Rearvy Buddy</div>
                      <div className={styles.emptyDesc}>
                        Ask me anything financial, or share your screen and I&apos;ll analyze it for you.
                      </div>
                      <div className={styles.suggestions}>
                        {["Analyze my portfolio risk", "What's the RSI telling me?", "Explain this chart pattern", "Best entry for NVDA?"].map((s) => (
                          <button
                            key={s}
                            className={styles.suggestion}
                            onClick={() => { setInputText(s); sendMessage(s); }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`${styles.message} ${msg.role === "user" ? styles.userMessage : styles.assistantMessage}`}
                    >
                      {msg.role === "assistant" && (
                        <span className={styles.msgIcon}><BuddyIcon size={14} /></span>
                      )}
                      <div className={styles.msgBubble}>
                        {msg.content || (loading && i === messages.length - 1 ? <TypingDots /> : "")}
                      </div>
                    </div>
                  ))}

                  {loading && messages[messages.length - 1]?.role !== "assistant" && (
                    <div className={`${styles.message} ${styles.assistantMessage}`}>
                      <span className={styles.msgIcon}><BuddyIcon size={14} /></span>
                      <div className={styles.msgBubble}><TypingDots /></div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div className={styles.inputArea}>
                  <button
                    className={`${styles.actionBtn} ${listening ? styles.activeBtn : ""}`}
                    onClick={listening ? stopListening : startListening}
                    title={listening ? "Stop listening" : "Push to talk"}
                    id="rearvy-buddy-voice-btn"
                  >
                    {listening ? "🔴" : "🎙️"}
                  </button>

                  <button
                    className={styles.actionBtn}
                    onClick={handleScreenCapture}
                    disabled={loading}
                    title="Capture screen for analysis"
                    id="rearvy-buddy-screen-btn"
                  >
                    📸
                  </button>

                  <input
                    ref={inputRef}
                    className={styles.input}
                    type="text"
                    placeholder={listening ? "Listening..." : "Ask Rearvy Buddy..."}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={loading || listening}
                    id="rearvy-buddy-input"
                  />

                  <button
                    className={`${styles.sendBtn} ${loading ? styles.loadingBtn : ""}`}
                    onClick={() => sendMessage()}
                    disabled={loading || !inputText.trim()}
                    id="rearvy-buddy-send-btn"
                  >
                    {loading ? <LoadingSpinner /> : "→"}
                  </button>
                </div>

                <div className={styles.footer}>
                  Powered by NVIDIA AI • Ctrl+Shift+B to toggle
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────
function BuddyIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="12" cy="12" r="10" fill="url(#buddyGrad)" />
      <path d="M8 9.5C8 8.67 8.67 8 9.5 8s1.5.67 1.5 1.5S10.33 11 9.5 11 8 10.33 8 9.5z" fill="white" />
      <path d="M13 9.5C13 8.67 13.67 8 14.5 8s1.5.67 1.5 1.5S15.33 11 14.5 11 13 10.33 13 9.5z" fill="white" />
      <path d="M8.5 14.5C9.5 16 14.5 16 15.5 14.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
      <defs>
        <linearGradient id="buddyGrad" x1="0" y1="0" x2="24" y2="24">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function TypingDots() {
  return (
    <span className={styles.typingDots}>
      <span>.</span><span>.</span><span>.</span>
    </span>
  );
}

function LoadingSpinner() {
  return <span className={styles.spinner} />;
}
