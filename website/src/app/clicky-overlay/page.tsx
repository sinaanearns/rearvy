"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Mic, MousePointer2, Pause, Play, Search, Sparkles } from "lucide-react";
import styles from "./clicky-overlay.module.css";

type MousePosition = { x: number; y: number };

type ClickyResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type ClickyAssistantEvent =
  | { type: "research-started"; query?: string }
  | { type: "research-completed"; headline?: string; results?: ClickyResult[] }
  | { type: "scrape-completed"; url?: string; result?: { title?: string; url?: string; summary?: string } }
  | { type: "policy-response" | "command-blocked"; message?: string }
  | { type: "decision-needed"; question?: string; userFacingSummary?: string }
  | { type: "decision-approved" };

type ClickyBridge = {
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  getMousePosition: () => Promise<MousePosition>;
  runCommand: (command: string) => Promise<unknown>;
  research?: (command: string) => Promise<unknown>;
  onStatus?: (callback: (status: unknown) => void) => () => void;
  onAssistantEvent?: (callback: (event: ClickyAssistantEvent) => void) => () => void;
};

type SpeechRecognitionResultEvent = {
  results?: ArrayLike<ArrayLike<{ transcript?: string }>>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type ClickyWindow = Window &
  typeof globalThis & {
    electron?: { clicky?: ClickyBridge };
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const COLLAPSED_SIZE = { width: 108, height: 108 };
const PANEL_SIZE = { width: 420, height: 560 };
const FOLLOW_OFFSET = 22;
const FOLLOW_INTERVAL_MS = 70;

const QUICK_ACTIONS = [
  "Open Shopify dashboard",
  "Research latest campaign metrics",
  "Summarize what is on this screen",
  "Guide me through the next step",
];

function getClickyBridge() {
  return (window as ClickyWindow).electron?.clicky;
}

function getSpeechRecognition() {
  const clickyWindow = window as ClickyWindow;
  return clickyWindow.SpeechRecognition ?? clickyWindow.webkitSpeechRecognition;
}

function readTranscript(event: SpeechRecognitionResultEvent) {
  return Array.from(event.results ?? [])
    .map((result) => result?.[0]?.transcript ?? "")
    .join(" ")
    .trim();
}

export default function ClickyOverlayPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isFollowing, setIsFollowing] = useState(true);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const [assistantNote, setAssistantNote] = useState("Ready near your cursor.");
  const [assistantResults, setAssistantResults] = useState<ClickyResult[]>([]);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });

  const lastWindowSizeRef = useRef(COLLAPSED_SIZE);
  const lastMousePositionRef = useRef<MousePosition | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    const preventDrag = (event: DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
    };

    document.addEventListener("dragstart", preventDrag, true);
    document.addEventListener("dragover", preventDrag, true);
    document.addEventListener("drop", preventDrag, true);

    return () => {
      document.removeEventListener("dragstart", preventDrag, true);
      document.removeEventListener("dragover", preventDrag, true);
      document.removeEventListener("drop", preventDrag, true);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  const handleAction = useCallback(async (action: string) => {
    const command = action.trim();
    if (!command) {
      return;
    }

    setLastCommand(command);
    setAssistantNote(`Running: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const bridge = getClickyBridge();
      if (bridge?.runCommand) {
        await bridge.runCommand(command);
      } else {
        setStatus("Desktop bridge unavailable");
        setAssistantNote("Open Clicky in the desktop app to run commands.");
      }
    } catch (error) {
      console.error("Failed to run clicky command:", error);
      setStatus("Error");
      setAssistantNote("Clicky could not run that command.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const handleResearch = useCallback(async (query: string) => {
    const command = query.trim();
    if (!command) {
      return;
    }

    setLastCommand(command);
    setAssistantNote(`Researching: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const bridge = getClickyBridge();
      if (bridge?.research) {
        await bridge.research(command);
      } else {
        await handleAction(command);
      }
    } catch (error) {
      console.error("Failed to research with clicky:", error);
      setStatus("Error");
      setAssistantNote("Clicky could not finish the research request.");
    } finally {
      setIsBusy(false);
    }
  }, [handleAction]);

  useEffect(() => {
    const targetSize = isOpen ? PANEL_SIZE : COLLAPSED_SIZE;
    const lastSize = lastWindowSizeRef.current;
    if (lastSize.width === targetSize.width && lastSize.height === targetSize.height) {
      return;
    }

    getClickyBridge()?.setSize(targetSize.width, targetSize.height);
    lastWindowSizeRef.current = targetSize;
  }, [isOpen]);

  useEffect(() => {
    if (!isFollowing || isOpen) {
      return;
    }

    let cancelled = false;

    const syncPosition = async () => {
      const bridge = getClickyBridge();
      if (!bridge?.getMousePosition || !bridge?.setPosition) {
        return;
      }

      try {
        const mousePosition = await bridge.getMousePosition();
        if (cancelled) {
          return;
        }

        const previous = lastMousePositionRef.current;
        if (previous?.x === mousePosition.x && previous?.y === mousePosition.y) {
          return;
        }

        lastMousePositionRef.current = mousePosition;
        bridge.setPosition(mousePosition.x + FOLLOW_OFFSET, mousePosition.y + FOLLOW_OFFSET);
      } catch {}
    };

    void syncPosition();
    const intervalId = window.setInterval(() => {
      void syncPosition();
    }, FOLLOW_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isFollowing, isOpen]);

  useEffect(() => {
    const bridge = getClickyBridge();
    if (!bridge?.onStatus && !bridge?.onAssistantEvent) {
      return;
    }

    const unsubscribeStatus = bridge.onStatus?.((newStatus) => {
      const nextStatus = String(newStatus || "Ready");
      setStatus(nextStatus);
      setIsBusy(nextStatus !== "Ready");
      if (nextStatus !== "Ready") {
        setLastCommand(nextStatus);
      }
    });

    const unsubscribeEvents = bridge.onAssistantEvent?.((event) => {
      if (event.type === "research-started") {
        setAssistantNote(`Researching: ${event.query || "request"}`);
        setAssistantResults([]);
      }

      if (event.type === "research-completed") {
        setAssistantNote(event.headline ? `Research complete: ${event.headline}` : "Research complete");
        setAssistantResults(Array.isArray(event.results) ? event.results : []);
      }

      if (event.type === "scrape-completed") {
        setAssistantNote(event.result?.title ? `Scraped: ${event.result.title}` : "Scrape complete");
        setAssistantResults([
          {
            title: event.result?.title || event.url || "Scraped page",
            url: event.result?.url || event.url || "",
            description: event.result?.summary || "",
            summary: event.result?.summary || "",
          },
        ]);
      }

      if (event.type === "policy-response" || event.type === "command-blocked") {
        setAssistantNote(event.message || "Clicky cannot help with that request.");
        setAssistantResults([]);
      }

      if (event.type === "decision-needed") {
        setAssistantNote(event.question || "Clicky needs approval before continuing.");
        setLastCommand(event.userFacingSummary || "Approval needed");
        setStatus("Waiting for approval");
        setIsBusy(false);
      }

      if (event.type === "decision-approved") {
        setAssistantNote("Approval received. Continuing.");
      }
    });

    return () => {
      unsubscribeStatus?.();
      unsubscribeEvents?.();
    };
  }, []);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || !allowWake) {
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
      return;
    }

    let mounted = true;

    const startRecognition = () => {
      if (!mounted) {
        return;
      }

      try {
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          const transcript = readTranscript(event);
          const normalized = transcript.toLowerCase();
          const wakeIndex = normalized.lastIndexOf("hey clicky");
          if (wakeIndex === -1) {
            return;
          }

          const command = transcript.slice(wakeIndex + "hey clicky".length).replace(/^[,.:;!?\s-]+/, "").trim();
          if (command) {
            void handleAction(command);
          } else {
            setStatus("Heard wake word");
          }
        };

        recognition.onend = () => {
          recognitionRef.current = null;
          if (mounted && allowWake) {
            window.setTimeout(startRecognition, 250);
          }
        };

        recognition.onerror = () => {
          setStatus("Wake word error");
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (error) {
        console.error("Failed to start Clicky wake recognition:", error);
        setStatus("Wake word unavailable");
      }
    };

    startRecognition();

    return () => {
      mounted = false;
      try {
        recognitionRef.current?.stop();
      } catch {}
      recognitionRef.current = null;
    };
  }, [allowWake, handleAction]);

  const toggleOpen = () => {
    setIsOpen((current) => {
      const nextOpen = !current;
      setIsFollowing(!nextOpen);
      return nextOpen;
    });
  };

  const handleVoice = () => {
    setIsListening((current) => !current);
    void handleAction("Voice Command");
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!inputText.trim()) {
      return;
    }

    void handleAction(inputText);
    setInputText("");
  };

  return (
    <div
      className={styles.clickyContainer}
      draggable={false}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.preventDefault()}
      onDragStart={(event) => event.preventDefault()}
    >
      <button
        type="button"
        draggable={false}
        aria-label="Toggle Clicky"
        className={`${styles.clickyIcon} ${isBusy ? styles.active : ""}`}
        onClick={toggleOpen}
      >
        <span className={styles.iconGlow} />
        <MousePointer2 size={18} aria-hidden />
      </button>

      {isOpen && (
        <div className={styles.panel} draggable={false}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <span className={styles.titleIcon}>
                <Sparkles size={13} aria-hidden />
              </span>
              <div>
                <div className={styles.title}>Clicky</div>
                <div className={styles.subtitle}>Cursor-side AI</div>
              </div>
            </div>
            <button
              type="button"
              className={styles.followBtn}
              data-following={isFollowing}
              onClick={() => setIsFollowing((current) => !current)}
              aria-pressed={isFollowing}
            >
              {isFollowing ? <Pause size={12} aria-hidden /> : <MousePointer2 size={12} aria-hidden />}
              {isFollowing ? "Pause" : "Follow"}
            </button>
          </div>

          <div className={styles.transcript}>
            <div className={styles.transcriptLabel}>Latest action</div>
            <div className={styles.transcriptText}>{lastCommand}</div>
          </div>

          <div className={styles.researchCard}>
            <div className={styles.transcriptLabel}>Assistant note</div>
            <div className={styles.researchNote}>{assistantNote}</div>
            {assistantResults.length > 0 && (
              <div className={styles.researchList}>
                {assistantResults.map((result) => (
                  <a
                    key={result.url || result.title}
                    className={styles.researchItem}
                    href={result.url || undefined}
                    target={result.url ? "_blank" : undefined}
                    rel={result.url ? "noreferrer" : undefined}
                  >
                    <div className={styles.researchItemTitle}>{result.title}</div>
                    <div className={styles.researchItemSummary}>{result.summary || result.description}</div>
                  </a>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleSubmit}>
            <input
              className={styles.input}
              placeholder="Ask Clicky to click, search, or explain..."
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              autoFocus
            />
          </form>

          <button
            type="button"
            className={`${styles.voiceBtn} ${isListening ? styles.voiceListening : ""}`}
            onClick={handleVoice}
          >
            <Mic size={14} aria-hidden />
            {isListening ? "Listening..." : "Push to talk"}
          </button>

          <button
            type="button"
            className={`${styles.wakeBtn} ${allowWake ? styles.wakeOn : ""}`}
            onClick={() => setAllowWake((current) => !current)}
            aria-pressed={allowWake}
          >
            <Mic size={13} aria-hidden />
            {allowWake ? "Wake on" : "Wake off"}
          </button>

          <div className={styles.actionGrid}>
            {QUICK_ACTIONS.map((action, index) => (
              <button
                key={action}
                type="button"
                className={styles.actionBtn}
                onClick={() => {
                  if (action.startsWith("Research")) {
                    void handleResearch(action);
                  } else {
                    void handleAction(action);
                  }
                }}
              >
                {index % 2 === 0 ? <Play size={12} aria-hidden /> : <Search size={12} aria-hidden />}
                {action}
              </button>
            ))}
          </div>

          <div className={styles.status}>
            <span className={styles.statusDot} data-busy={isBusy} />
            {status}
          </div>
        </div>
      )}
    </div>
  );
}
