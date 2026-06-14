"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MousePointer2, Square } from "lucide-react";
import {
  MariaVoiceAgentError,
  MariaVoiceAgentSession,
  getMariaVoiceAgentFailureMessage,
  type MariaVoiceAgentStatus,
  type MariaVoiceAgentToolRequest,
  type MariaVoiceAgentToolResult,
} from "@/lib/maria/voice-agent";
import { getIdToken } from "@/lib/firebase/auth";
import { summarizeMariaReadiness } from "@/lib/maria/readiness";
import { speakMariaText, type MariaSpeechPlayback } from "@/lib/maria/speech";
import { isScreenAnalysisRequest } from "@/lib/screen-intent";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import styles from "./maria-overlay.module.css";

type MousePosition = { x: number; y: number };

type MariaDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  latestPosition: MousePosition;
  hasMoved: boolean;
};

type MariaResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type MariaCommandPayload = {
  command: string;
  requestId: string;
  origin: "maria-overlay" | "maria";
};

type MariaCommandResult = {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
};

type AutomatonAlert = {
  id: string;
  title?: string;
  summary?: string;
  message_text?: string;
};

type MariaInteractiveRegion =
  | { type: "circle"; centerX: number; centerY: number; radius: number }
  | { type: "rect"; x: number; y: number; width: number; height: number };

type MariaAssistantEvent =
  | { type: "command-stopped"; reason?: string; message?: string }
  | { type: "research-started"; query?: string }
  | { type: "research-completed"; headline?: string; results?: MariaResult[] }
  | { type: "scrape-completed"; url?: string; result?: { title?: string; url?: string; summary?: string } }
  | { type: "screen-analysis-started"; command?: string; hasScreenshot?: boolean }
  | { type: "screen-analysis-completed"; command?: string; reply?: string }
  | { type: "screen-analysis-failed"; command?: string; message?: string }
  | { type: "screen-point"; command?: string; x?: number; y?: number; label?: string; spokenText?: string; screenNumber?: number | null }
  | { type: "shortcut"; action?: "toggle-voice" | "inspect-screen" | string; shortcut?: string; command?: string; origin?: string }
  | { type: "assistant-reply"; reply?: string; message?: string; requestId?: string; origin?: string; source?: string }
  | { type: "policy-response" | "command-blocked"; message?: string }
  | { type: "wake-word-detected"; transcript?: string; command?: string };

type MariaBridge = {
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  setInteractiveRegions?: (regions: MariaInteractiveRegion[]) => void;
  setMousePassthrough?: (passthrough: boolean) => void;
  getMousePosition: () => Promise<MousePosition>;
  getReadiness?: () => Promise<unknown>;
  runCommand: (command: string | MariaCommandPayload) => Promise<unknown>;
  research?: (command: string | MariaCommandPayload) => Promise<unknown>;
  stop?: () => Promise<unknown>;
  onStatus?: (callback: (status: unknown) => void) => () => void;
  onAssistantEvent?: (callback: (event: MariaAssistantEvent) => void) => () => void;
};

type MariaPointTarget = {
  id: number;
  x: number;
  y: number;
  label: string;
  spokenText: string;
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

type MariaWindow = Window &
  typeof globalThis & {
    electron?: {
      maria?: MariaBridge;
    };
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const COLLAPSED_SIZE = { width: 108, height: 108 };
const TALK_SIZE = { width: 280, height: 154 };
const POINT_SIZE = { width: 280, height: 154 };
const FOLLOW_OFFSET = 22;
const FOLLOW_INTERVAL_MS = 70;
const DRAG_THRESHOLD_PX = 3;
const ATTENTION_FLASH_MS = 1200;
const POINT_HOLD_MS = 4800;
const MARIA_INTERACTIVE_SELECTOR = "[data-maria-interactive='true']";
const MARIA_HITBOX_PADDING_PX = 18;
const MARIA_POSITION_STORAGE_KEY = "maria.manualPosition";
const POINT_ICON_CENTER = { x: 237, y: 111 };
const MARIA_WAVEFORM_LEVELS = [0.42, 0.78, 1, 0.68, 0.5] as const;
const log = createClientLogger("MariaOverlay");

const OVERLAY_DOCUMENT_STYLES = [
  ["width", "100%", ""],
  ["height", "100%", ""],
  ["margin", "0", ""],
  ["overflow", "hidden", "important"],
  ["background", "transparent", "important"],
  ["user-select", "none", ""],
  ["-webkit-user-select", "none", ""],
  ["-webkit-user-drag", "none", ""],
  ["-webkit-touch-callout", "none", ""],
  ["-webkit-app-region", "no-drag", ""],
] as const;

function getMariaBridge() {
  return (window as MariaWindow).electron?.maria;
}

function createMariaPayload(
  command: string,
  requestId = crypto.randomUUID(),
  origin: MariaCommandPayload["origin"] = "maria-overlay"
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

function getSpeechRecognition() {
  const mariaWindow = window as MariaWindow;
  return mariaWindow.SpeechRecognition ?? mariaWindow.webkitSpeechRecognition;
}

function readTranscript(event: SpeechRecognitionResultEvent) {
  return Array.from(event.results ?? [])
    .map((result) => result?.[0]?.transcript ?? "")
    .join(" ")
    .trim();
}

function getSpeechRecognitionErrorCode(error: unknown) {
  if (isRecord(error)) {
    const record = error;
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

function ignoreExpectedMariaOverlayError(error: unknown) {
  void error;
}

function stopOverlaySpeechRecognition(recognition: SpeechRecognitionLike | null) {
  if (!recognition) {
    return;
  }

  try {
    recognition.stop();
  } catch (error) {
    ignoreExpectedMariaOverlayError(error);
  }
}

function isMariaInteractiveTarget(target: Element | null, clientX: number, clientY: number) {
  const interactiveTarget = target?.closest(MARIA_INTERACTIVE_SELECTOR);
  if (!interactiveTarget) {
    return false;
  }

  if (interactiveTarget.getAttribute("data-maria-hitbox") !== "circle") {
    return true;
  }

  const bounds = interactiveTarget.getBoundingClientRect();
  const radius = Math.max(bounds.width, bounds.height) / 2 + MARIA_HITBOX_PADDING_PX;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  return Math.hypot(clientX - centerX, clientY - centerY) <= radius;
}

function isMariaInteractivePoint(clientX: number, clientY: number) {
  return isMariaInteractiveTarget(document.elementFromPoint(clientX, clientY), clientX, clientY);
}

function isMariaInteractiveEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(MARIA_INTERACTIVE_SELECTOR));
}

function readSavedMariaPosition(): MousePosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(MARIA_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as unknown;
    if (!isRecord(value)) {
      return null;
    }

    if (typeof value.x !== "number" || typeof value.y !== "number") {
      return null;
    }

    if (!Number.isFinite(value.x) || !Number.isFinite(value.y)) {
      return null;
    }

    return { x: value.x, y: value.y };
  } catch {
    return null;
  }
}

async function readJson(response: Response) {
  return (await response.json().catch(() => null)) as unknown;
}

function readAutomatonAlert(payload: unknown): AutomatonAlert | null {
  if (!isRecord(payload) || !Array.isArray(payload.alerts)) {
    return null;
  }

  const firstAlert = payload.alerts[0];
  if (!isRecord(firstAlert) || typeof firstAlert.id !== "string" || !firstAlert.id.trim()) {
    return null;
  }

  return {
    id: firstAlert.id,
    title: typeof firstAlert.title === "string" ? firstAlert.title : undefined,
    summary: typeof firstAlert.summary === "string" ? firstAlert.summary : undefined,
    message_text: typeof firstAlert.message_text === "string" ? firstAlert.message_text : undefined,
  };
}

function saveMariaPosition(position: MousePosition) {
  try {
    localStorage.setItem(
      MARIA_POSITION_STORAGE_KEY,
      JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) })
    );
  } catch (error) {
    ignoreExpectedMariaOverlayError(error);
  }
}

function getPointerScreenPosition(event: { screenX: number; screenY: number }): MousePosition {
  return { x: event.screenX, y: event.screenY };
}

export default function MariaOverlayPage() {
  const [initialSavedPosition] = useState(() => readSavedMariaPosition());
  const [isFollowing, setIsFollowing] = useState(() => initialSavedPosition === null);
  const [isMariaStarted, setIsMariaStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isMariaDragSessionActive, setIsMariaDragSessionActive] = useState(false);
  const [isDraggingMaria, setIsDraggingMaria] = useState(false);
  const [isAttentionFlashActive, setIsAttentionFlashActive] = useState(false);
  const [assistantNote, setAssistantNote] = useState("Ready near your cursor.");
  const [mariaInputLevel, setMariaInputLevel] = useState(0);
  const [pointTarget, setPointTarget] = useState<MariaPointTarget | null>(null);
  const [isSpeakingReply, setIsSpeakingReply] = useState(false);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("maria.allowWake") === "true";
    } catch {
      return false;
    }
  });

  const lastWindowSizeRef = useRef(COLLAPSED_SIZE);
  const lastWindowPositionRef = useRef<MousePosition | null>(initialSavedPosition);
  const windowMoveAnimationRef = useRef<number | null>(null);
  const lastMousePositionRef = useRef<MousePosition | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const attentionFlashTimerRef = useRef<number | null>(null);
  const wakeRecognitionRestartTimerRef = useRef<number | null>(null);
  const wakeRecognitionFailureCountRef = useRef(0);
  const clickToTalkSessionRef = useRef(0);
  const dragStateRef = useRef<MariaDragState | null>(null);
  const mariaButtonRef = useRef<HTMLButtonElement | null>(null);
  const latestAutomatonAlertIdRef = useRef<string | null>(null);
  const suppressClickUntilRef = useRef(0);
  const hasManualPositionRef = useRef(initialSavedPosition !== null);
  const voiceAgentSessionRef = useRef<MariaVoiceAgentSession | null>(null);
  const voiceAgentStopRequestedRef = useRef(false);
  const voiceAgentSessionVersionRef = useRef(0);
  const isMousePassthroughRef = useRef<boolean | null>(null);
  const pointClearTimerRef = useRef<number | null>(null);
  const speechPlaybackRef = useRef<MariaSpeechPlayback | null>(null);
  const spokenReplyKeyRef = useRef("");

  useEffect(() => {
    const targets = [document.documentElement, document.body, document.getElementById("__next")].filter(
      (target): target is HTMLElement => Boolean(target)
    );

    const previousStyles = targets.map((target) => ({
      target,
      values: OVERLAY_DOCUMENT_STYLES.map(([property]) => ({
        property,
        value: target.style.getPropertyValue(property),
        priority: target.style.getPropertyPriority(property),
      })),
    }));

    for (const target of targets) {
      for (const [property, value, priority] of OVERLAY_DOCUMENT_STYLES) {
        target.style.setProperty(property, value, priority);
      }
    }

    return () => {
      for (const { target, values } of previousStyles) {
        for (const { property, value, priority } of values) {
          if (value) {
            target.style.setProperty(property, value, priority);
          } else {
            target.style.removeProperty(property);
          }
        }
      }
    };
  }, []);

  const stopCurrentRecognition = useCallback(() => {
    stopOverlaySpeechRecognition(recognitionRef.current);
    recognitionRef.current = null;
  }, []);

  const setMariaMousePassthrough = useCallback((passthrough: boolean) => {
    if (isMousePassthroughRef.current === passthrough) {
      return;
    }

    getMariaBridge()?.setMousePassthrough?.(passthrough);
    isMousePassthroughRef.current = passthrough;
  }, []);

  const cancelAssistantSpeech = useCallback(() => {
    speechPlaybackRef.current?.cancel();
    speechPlaybackRef.current = null;
    setIsSpeakingReply(false);
  }, []);

  const speakAssistantReply = useCallback((event: Extract<MariaAssistantEvent, { type: "assistant-reply" }>) => {
    const text = String(event.reply || event.message || "").replace(/\s+/g, " ").trim();
    if (!text || event.origin === "maria" || event.origin === "wake-listener" || voiceAgentSessionRef.current) {
      return;
    }

    const key = `${event.requestId || ""}:${event.origin || ""}:${text}`;
    if (spokenReplyKeyRef.current === key) {
      return;
    }

    let playback: MariaSpeechPlayback | null = null;
    playback = speakMariaText(text, {
      cancelExisting: true,
      onStart: () => setIsSpeakingReply(true),
      onEnd: () => {
        if (speechPlaybackRef.current === playback) {
          speechPlaybackRef.current = null;
          setIsSpeakingReply(false);
        }
      },
      onError: () => {
        if (speechPlaybackRef.current === playback) {
          speechPlaybackRef.current = null;
          setIsSpeakingReply(false);
        }
      },
    });

    if (playback) {
      spokenReplyKeyRef.current = key;
      speechPlaybackRef.current = playback;
    }
  }, []);

  const syncMariaInteractiveRegions = useCallback(() => {
    const bridge = getMariaBridge();
    if (!bridge?.setInteractiveRegions) {
      return;
    }

    const interactiveElements = Array.from(
      document.querySelectorAll<HTMLElement>(MARIA_INTERACTIVE_SELECTOR)
    );
    if (interactiveElements.length === 0) {
      bridge.setInteractiveRegions([]);
      return;
    }

    const regions = interactiveElements.flatMap((element): MariaInteractiveRegion[] => {
      const bounds = element.getBoundingClientRect();
      if (bounds.width <= 0 || bounds.height <= 0) {
        return [];
      }

      if (element.getAttribute("data-maria-hitbox") === "circle") {
        return [
          {
            type: "circle",
            centerX: bounds.left + bounds.width / 2,
            centerY: bounds.top + bounds.height / 2,
            radius: Math.max(bounds.width, bounds.height) / 2 + MARIA_HITBOX_PADDING_PX,
          },
        ];
      }

      return [
        {
          type: "rect",
          x: bounds.left,
          y: bounds.top,
          width: bounds.width,
          height: bounds.height,
        },
      ];
    });

    bridge.setInteractiveRegions(regions);
  }, []);

  const setOverlayPosition = useCallback((position: MousePosition) => {
    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };

    lastWindowPositionRef.current = nextPosition;
    getMariaBridge()?.setPosition(nextPosition.x, nextPosition.y);
  }, []);

  const animateOverlayPosition = useCallback((targetPosition: MousePosition) => {
    if (windowMoveAnimationRef.current !== null) {
      window.cancelAnimationFrame(windowMoveAnimationRef.current);
      windowMoveAnimationRef.current = null;
    }

    const startPosition = lastWindowPositionRef.current || targetPosition;
    const startedAt = performance.now();
    const durationMs = 620;
    const easeOutCubic = (value: number) => 1 - Math.pow(1 - value, 3);

    const step = (timestamp: number) => {
      const progress = Math.min(1, (timestamp - startedAt) / durationMs);
      const eased = easeOutCubic(progress);
      setOverlayPosition({
        x: startPosition.x + (targetPosition.x - startPosition.x) * eased,
        y: startPosition.y + (targetPosition.y - startPosition.y) * eased,
      });

      if (progress < 1) {
        windowMoveAnimationRef.current = window.requestAnimationFrame(step);
      } else {
        windowMoveAnimationRef.current = null;
      }
    };

    windowMoveAnimationRef.current = window.requestAnimationFrame(step);
  }, [setOverlayPosition]);

  const resetMariaMousePassthrough = useCallback(() => {
    setMariaMousePassthrough(false);
  }, [setMariaMousePassthrough]);

  const enableIdleMariaMousePassthrough = useCallback(() => {
    if (!dragStateRef.current) {
      setMariaMousePassthrough(true);
      resumeMariaFollowing();
    }
  }, [resumeMariaFollowing, setMariaMousePassthrough]);

  const resumeMariaFollowing = useCallback(() => {
    if (!hasManualPositionRef.current) {
      setIsFollowing(true);
    }
  }, []);

  const triggerAttentionFlash = useCallback(() => {
    setIsAttentionFlashActive(true);

    if (attentionFlashTimerRef.current !== null) {
      window.clearTimeout(attentionFlashTimerRef.current);
    }

    attentionFlashTimerRef.current = window.setTimeout(() => {
      attentionFlashTimerRef.current = null;
      setIsAttentionFlashActive(false);
    }, ATTENTION_FLASH_MS);
  }, []);

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
    return () => {
      if (attentionFlashTimerRef.current !== null) {
        window.clearTimeout(attentionFlashTimerRef.current);
        attentionFlashTimerRef.current = null;
      }
      if (wakeRecognitionRestartTimerRef.current !== null) {
        window.clearTimeout(wakeRecognitionRestartTimerRef.current);
        wakeRecognitionRestartTimerRef.current = null;
      }
      if (pointClearTimerRef.current !== null) {
        window.clearTimeout(pointClearTimerRef.current);
        pointClearTimerRef.current = null;
      }
      if (windowMoveAnimationRef.current !== null) {
        window.cancelAnimationFrame(windowMoveAnimationRef.current);
        windowMoveAnimationRef.current = null;
      }

      void voiceAgentSessionRef.current?.stop();
      voiceAgentSessionRef.current = null;
      speechPlaybackRef.current?.cancel();
      speechPlaybackRef.current = null;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("maria.allowWake", allowWake ? "true" : "false");
    } catch (error) {
      ignoreExpectedMariaOverlayError(error);
    }
  }, [allowWake]);

  useEffect(() => {
    const bridge = getMariaBridge();
    let cancelled = false;

    if (!bridge?.getReadiness) {
      const summary = summarizeMariaReadiness(null);
      setStatus(summary.status);
      setAssistantNote(summary.note);
      return;
    }

    void bridge
      .getReadiness()
      .then((readiness) => {
        if (cancelled) {
          return;
        }

        const summary = summarizeMariaReadiness(readiness);
        setStatus(summary.status);
        setAssistantNote(summary.note);
      })
      .catch(() => {
        if (cancelled) {
          return;
        }

        const summary = summarizeMariaReadiness(null);
        setStatus(summary.status);
        setAssistantNote(summary.note);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialSavedPosition) {
      return;
    }

    setOverlayPosition(initialSavedPosition);
  }, [initialSavedPosition, setOverlayPosition]);

  useEffect(() => {
    const updateMousePassthrough = (event: MouseEvent) => {
      if (dragStateRef.current) {
        setMariaMousePassthrough(false);
        return;
      }

      const isInteractive = isMariaInteractivePoint(event.clientX, event.clientY);
      setMariaMousePassthrough(!isInteractive);

      if (!isInteractive) {
        resumeMariaFollowing();
      }
    };

    enableIdleMariaMousePassthrough();
    document.addEventListener("mousemove", updateMousePassthrough, true);
    document.addEventListener("mouseleave", enableIdleMariaMousePassthrough, true);
    document.addEventListener("pointercancel", enableIdleMariaMousePassthrough, true);
    window.addEventListener("blur", enableIdleMariaMousePassthrough);

    return () => {
      document.removeEventListener("mousemove", updateMousePassthrough, true);
      document.removeEventListener("mouseleave", enableIdleMariaMousePassthrough, true);
      document.removeEventListener("pointercancel", enableIdleMariaMousePassthrough, true);
      window.removeEventListener("blur", enableIdleMariaMousePassthrough);
      resetMariaMousePassthrough();
    };
  }, [enableIdleMariaMousePassthrough, resetMariaMousePassthrough, setMariaMousePassthrough]);

  const forceStopMaria = useCallback(async () => {
    clickToTalkSessionRef.current += 1;
    setIsMariaStarted(false);
    setIsBusy(false);
    setIsListening(false);
    setMariaInputLevel(0);
    setPointTarget(null);
    resumeMariaFollowing();
    setAllowWake(false);
    setStatus("Ready");
    setAssistantNote("Maria stopped.");

    voiceAgentStopRequestedRef.current = true;
    voiceAgentSessionVersionRef.current += 1;
    const voiceAgentSession = voiceAgentSessionRef.current;
    voiceAgentSessionRef.current = null;
    await voiceAgentSession?.stop().catch(() => undefined);
    stopCurrentRecognition();

    try {
      const bridge = getMariaBridge();
      if (bridge?.stop) {
        await bridge.stop();
        return;
      }

      await bridge?.runCommand?.({
        command: "stop",
        requestId: crypto.randomUUID(),
        origin: "maria-overlay",
      });
    } catch (error) {
      log.error("Failed to stop Maria:", error);
    }
  }, [resumeMariaFollowing, stopCurrentRecognition]);

  const handleAction = useCallback(async (action: string) => {
    const command = action.trim();
    if (!command) {
      return;
    }

    setAssistantNote(`Running: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const bridge = getMariaBridge();
      if (bridge?.runCommand) {
        await bridge.runCommand(createMariaPayload(command, crypto.randomUUID(), "maria-overlay"));
      } else {
        setStatus("Desktop bridge unavailable");
        setAssistantNote("Open Maria in the desktop app to run commands.");
      }
    } catch (error) {
      log.error("Failed to run maria command:", error);
      setStatus("Error");
      setAssistantNote("Maria could not run that command.");
    } finally {
      setIsBusy(false);
    }
  }, []);

  const applyVoiceAgentStatus = useCallback((nextStatus: MariaVoiceAgentStatus) => {
    setStatus(nextStatus);
    setIsBusy(
      nextStatus === "Connecting" ||
        nextStatus === "Maria thinking" ||
        nextStatus === "Maria speaking" ||
        nextStatus === "Running Maria action"
    );
  }, []);

  const runVoiceAgentMariaTool = useCallback(async ({
    callId,
    command,
    mode,
  }: MariaVoiceAgentToolRequest): Promise<MariaVoiceAgentToolResult> => {
    const requestId = callId || crypto.randomUUID();
    const payload = createMariaPayload(command, requestId, "maria");
    setAssistantNote(`Running Maria action: ${command}`);
    setStatus("Running Maria action");
    setIsBusy(true);

    try {
      const maria = getMariaBridge();
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
      return {
        ok: false,
        message: "Desktop bridge unavailable.",
      };
    } catch (error) {
      const message = getErrorMessage(error, "Maria could not run that action.");
      log.error("Failed to run AssemblyAI Maria tool:", error);
      setStatus("Error");
      setAssistantNote("Maria could not run that action.");
      return {
        ok: false,
        message,
      };
    } finally {
      setIsBusy(false);
    }
  }, []);

  const startMaria = useCallback(async () => {
    if (voiceAgentSessionRef.current) {
      return;
    }

    cancelAssistantSpeech();
    const sessionId = clickToTalkSessionRef.current + 1;
    clickToTalkSessionRef.current = sessionId;
    const voiceSessionVersion = voiceAgentSessionVersionRef.current + 1;
    voiceAgentSessionVersionRef.current = voiceSessionVersion;
    const isCurrentVoiceSession = () => voiceAgentSessionVersionRef.current === voiceSessionVersion;

    setIsMariaStarted(true);
    setIsFollowing(false);
    setIsListening(true);
    setStatus("Connecting");
    setAssistantNote("Connecting AssemblyAI Voice Agent...");
    triggerAttentionFlash();
    stopCurrentRecognition();

    const session = new MariaVoiceAgentSession({
      onStatus: (nextStatus) => {
        if (isCurrentVoiceSession()) {
          applyVoiceAgentStatus(nextStatus);
        }
      },
      onNote: (note) => {
        if (isCurrentVoiceSession()) {
          setAssistantNote(note);
        }
      },
      onInputLevel: (level) => {
        if (isCurrentVoiceSession()) {
          setMariaInputLevel((current) => (Math.abs(current - level) > 0.02 ? level : current));
        }
      },
      onToolCall: async (request) => {
        if (!isCurrentVoiceSession()) {
          return {
            ok: false,
            message: "Voice session stopped.",
          };
        }

        return await runVoiceAgentMariaTool(request);
      },
      onError: (message, error) => {
        if (!isCurrentVoiceSession()) {
          return;
        }

        log.warn("[MariaVoiceAgent] Overlay error", error);
        setAssistantNote(message);
      },
    });

    voiceAgentStopRequestedRef.current = false;
    voiceAgentSessionRef.current = session;

    try {
      await session.start();
    } catch (error) {
      if (!isCurrentVoiceSession()) {
        return;
      }

      if (
        voiceAgentStopRequestedRef.current ||
        (error instanceof MariaVoiceAgentError && error.code === "voice_agent_disconnected")
      ) {
        voiceAgentStopRequestedRef.current = false;
        setAssistantNote("AssemblyAI Voice Agent disconnected.");
        setStatus("Disconnected");
      } else {
        log.warn("[MariaVoiceAgent] Overlay failed to start", error);
        setAssistantNote(getMariaVoiceAgentFailureMessage(error));
        setStatus("Voice Agent unavailable");
      }

      if (voiceAgentSessionRef.current === session) {
        voiceAgentSessionRef.current = null;
      }
      await session.stop().catch(() => undefined);
      setIsMariaStarted(false);
      setIsListening(false);
      setMariaInputLevel(0);
      resumeMariaFollowing();
      setIsBusy(false);
    }
  }, [
    applyVoiceAgentStatus,
    cancelAssistantSpeech,
    resumeMariaFollowing,
    runVoiceAgentMariaTool,
    stopCurrentRecognition,
    triggerAttentionFlash,
  ]);

  const applyMariaDragPosition = useCallback((pointerPosition: MousePosition) => {
    const dragState = dragStateRef.current;
    if (!dragState) {
      return false;
    }

    const distance = Math.hypot(pointerPosition.x - dragState.startX, pointerPosition.y - dragState.startY);
    const nextPosition = {
      x: pointerPosition.x - dragState.offsetX,
      y: pointerPosition.y - dragState.offsetY,
    };

    dragState.latestPosition = nextPosition;

    if (!dragState.hasMoved && distance >= DRAG_THRESHOLD_PX) {
      dragState.hasMoved = true;
      hasManualPositionRef.current = true;
      setIsDraggingMaria(true);
    }

    if (dragState.hasMoved) {
      setOverlayPosition(nextPosition);
    }

    setIsFollowing(false);
    setMariaMousePassthrough(false);
    return true;
  }, [setMariaMousePassthrough, setOverlayPosition]);

  const updateMariaDragFromPointer = useCallback((event: ReactPointerEvent<HTMLElement> | PointerEvent) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return false;
    }

    event.preventDefault();
    return applyMariaDragPosition(getPointerScreenPosition(event));
  }, [applyMariaDragPosition]);

  const finishMariaDragSession = useCallback((pointerId?: number) => {
    const dragState = dragStateRef.current;
    if (!dragState || (typeof pointerId === "number" && dragState.pointerId !== pointerId)) {
      enableIdleMariaMousePassthrough();
      return false;
    }

    dragStateRef.current = null;
    setIsMariaDragSessionActive(false);
    setIsDraggingMaria(false);

    const mariaButton = mariaButtonRef.current;
    if (mariaButton && typeof pointerId === "number") {
      try {
        if (mariaButton.hasPointerCapture(pointerId)) {
          mariaButton.releasePointerCapture(pointerId);
        }
      } catch (error) {
        ignoreExpectedMariaOverlayError(error);
      }
    }

    if (dragState.hasMoved) {
      suppressClickUntilRef.current = performance.now() + 250;
      hasManualPositionRef.current = true;
      setIsFollowing(false);
      saveMariaPosition(dragState.latestPosition);
    }

    enableIdleMariaMousePassthrough();
    return dragState.hasMoved;
  }, [enableIdleMariaMousePassthrough]);

  const handleMariaPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    // Immediately disable passthrough when we intend to start a drag
    setMariaMousePassthrough(false);

    if (event.button !== 0 || !isMariaInteractiveTarget(event.currentTarget, event.clientX, event.clientY)) {
      return;
    }

    if (windowMoveAnimationRef.current !== null) {
      window.cancelAnimationFrame(windowMoveAnimationRef.current);
      windowMoveAnimationRef.current = null;
    }

    const pointerPosition = getPointerScreenPosition(event);
    const nextPosition = {
      x: pointerPosition.x - event.clientX,
      y: pointerPosition.y - event.clientY,
    };

    dragStateRef.current = {
      pointerId: event.pointerId,
      offsetX: event.clientX,
      offsetY: event.clientY,
      startX: pointerPosition.x,
      startY: pointerPosition.y,
      latestPosition: nextPosition,
      hasMoved: false,
    };

    setMariaMousePassthrough(false);
    setIsFollowing(false);
    setIsMariaDragSessionActive(true);

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch (error) {
      ignoreExpectedMariaOverlayError(error);
    }
  }, [setMariaMousePassthrough]);

  const handleMariaPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    updateMariaDragFromPointer(event);
  }, [updateMariaDragFromPointer]);

  const finishMariaDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const moved = finishMariaDragSession(event.pointerId);
    if (moved) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, [finishMariaDragSession]);

  useEffect(() => {
    if (!isMariaDragSessionActive) {
      return;
    }

    let cancelled = false;
    let cursorPollInFlight = false;
    let cursorPollTimer: number | null = null;

    const syncToElectronCursor = () => {
      const bridge = getMariaBridge();
      if (!bridge?.getMousePosition || cursorPollInFlight || !dragStateRef.current) {
        return;
      }

      cursorPollInFlight = true;
      void bridge
        .getMousePosition()
        .then((position) => {
          if (!cancelled && dragStateRef.current) {
            applyMariaDragPosition(position);
          }
        })
        .catch(ignoreExpectedMariaOverlayError)
        .finally(() => {
          cursorPollInFlight = false;
        });
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (updateMariaDragFromPointer(event)) {
        event.stopPropagation();
      }
    };

    const handlePointerRelease = (event: PointerEvent) => {
      const moved = finishMariaDragSession(event.pointerId);
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      if (!dragStateRef.current) {
        return;
      }

      event.preventDefault();
      applyMariaDragPosition(getPointerScreenPosition(event));
    };

    const handleMouseRelease = (event: MouseEvent) => {
      const moved = finishMariaDragSession();
      if (moved) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const handleBlur = () => {
      finishMariaDragSession();
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerRelease, true);
    window.addEventListener("pointercancel", handlePointerRelease, true);
    window.addEventListener("mousemove", handleMouseMove, true);
    window.addEventListener("mouseup", handleMouseRelease, true);
    window.addEventListener("blur", handleBlur);

    syncToElectronCursor();
    cursorPollTimer = window.setInterval(syncToElectronCursor, 32);

    return () => {
      cancelled = true;
      if (cursorPollTimer !== null) {
        window.clearInterval(cursorPollTimer);
      }
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerRelease, true);
      window.removeEventListener("pointercancel", handlePointerRelease, true);
      window.removeEventListener("mousemove", handleMouseMove, true);
      window.removeEventListener("mouseup", handleMouseRelease, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, [
    applyMariaDragPosition,
    finishMariaDragSession,
    isMariaDragSessionActive,
    updateMariaDragFromPointer,
  ]);

  const handleMariaButton = useCallback(() => {
    if (performance.now() < suppressClickUntilRef.current) {
      return;
    }

    if (isMariaStarted || isBusy || isListening) {
      void forceStopMaria();
      return;
    }

    void startMaria();
  }, [forceStopMaria, isBusy, isMariaStarted, isListening, startMaria]);

  const isMariaActive = isMariaStarted || isBusy || isListening;
  const isPointing = Boolean(pointTarget);
  const shouldShowPrompt = isMariaActive || isPointing;
  const isMariaListening = isListening || status === "Maria listening" || status === "Listening" || status === "Heard wake word";
  const isMariaThinking = status === "Connecting" || status === "Maria thinking" || status === "Running Maria action" || status === "Working";
  const isMariaSpeaking = isSpeakingReply || status === "Maria speaking";
  const mariaIconClassName = [
    styles.mariaIcon,
    isMariaActive ? styles.active : "",
    isMariaListening ? styles.listening : "",
    isMariaThinking ? styles.thinking : "",
    isMariaSpeaking ? styles.speaking : "",
    isAttentionFlashActive ? styles.attention : "",
    isDraggingMaria ? styles.dragging : "",
    isPointing ? styles.pointIcon : "",
  ]
    .filter(Boolean)
    .join(" ");
  const containerClassName = [
    styles.mariaContainer,
    shouldShowPrompt ? styles.withPrompt : "",
    isPointing ? styles.pointing : "",
    isMariaListening ? styles.listening : "",
    isMariaThinking ? styles.thinking : "",
    isMariaSpeaking ? styles.speaking : "",
  ]
    .filter(Boolean)
    .join(" ");

  useLayoutEffect(() => {
    syncMariaInteractiveRegions();

    const animationFrame = window.requestAnimationFrame(syncMariaInteractiveRegions);
    return () => window.cancelAnimationFrame(animationFrame);
  }, [containerClassName, isMariaActive, isDraggingMaria, isPointing, syncMariaInteractiveRegions]);

  useEffect(() => {
    const targetSize = isPointing ? POINT_SIZE : isMariaActive ? TALK_SIZE : COLLAPSED_SIZE;
    const lastSize = lastWindowSizeRef.current;
    if (lastSize.width === targetSize.width && lastSize.height === targetSize.height) {
      return;
    }

    getMariaBridge()?.setSize(targetSize.width, targetSize.height);
    lastWindowSizeRef.current = targetSize;
  }, [isMariaActive, isPointing]);

  useEffect(() => {
    if (!isFollowing || isMariaActive || isPointing) {
      return;
    }

    let cancelled = false;

    const syncPosition = async () => {
      const bridge = getMariaBridge();
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
        setOverlayPosition({ x: mousePosition.x + FOLLOW_OFFSET, y: mousePosition.y + FOLLOW_OFFSET });
      } catch (error) {
        ignoreExpectedMariaOverlayError(error);
      }
    };

    void syncPosition();
    const intervalId = window.setInterval(() => {
      void syncPosition();
    }, FOLLOW_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [isMariaActive, isFollowing, isPointing, setOverlayPosition]);

  useEffect(() => {
    const bridge = getMariaBridge();
    if (!bridge?.onStatus && !bridge?.onAssistantEvent) {
      return;
    }

    const unsubscribeStatus = bridge.onStatus?.((newStatus) => {
      const nextStatus = String(newStatus || "Ready");
      setStatus(nextStatus);
      setIsBusy(nextStatus !== "Ready");
    });

    const unsubscribeEvents = bridge.onAssistantEvent?.((event) => {
      if (event.type === "shortcut") {
        triggerAttentionFlash();

        if (event.action === "inspect-screen") {
          const command = event.command || "Take a screenshot and tell me what you see.";
          setAssistantNote("Shortcut: inspecting the screen...");
          void handleAction(command);
          return;
        }

        if (event.action === "toggle-voice") {
          handleMariaButton();
          return;
        }
      }

      if (event.type === "research-started") {
        setAssistantNote(`Researching: ${event.query || "request"}`);
      }

      if (event.type === "research-completed") {
        setAssistantNote(event.headline ? `Research complete: ${event.headline}` : "Research complete");
      }

      if (event.type === "scrape-completed") {
        setAssistantNote(event.result?.title ? `Scraped: ${event.result.title}` : "Scrape complete");
      }

      if (event.type === "screen-analysis-started") {
        setAssistantNote("Analyzing the current screen...");
      }

      if (event.type === "screen-analysis-completed") {
        setAssistantNote(event.reply || "Screen analysis complete.");
      }

      if (event.type === "screen-analysis-failed") {
        setAssistantNote(event.message || "Maria could not capture the screen.");
      }

      if (event.type === "screen-point") {
        const x = Number(event.x);
        const y = Number(event.y);
        if (Number.isFinite(x) && Number.isFinite(y)) {
          const label = String(event.label || "this").trim() || "this";
          const spokenText = String(event.spokenText || "").trim();
          setPointTarget({
            id: Date.now(),
            x,
            y,
            label,
            spokenText,
          });
          setIsFollowing(false);
          setStatus("Pointing");
          setAssistantNote(spokenText || `Pointing at ${label}.`);
          animateOverlayPosition({
            x: x - POINT_ICON_CENTER.x,
            y: y - POINT_ICON_CENTER.y,
          });

          if (pointClearTimerRef.current !== null) {
            window.clearTimeout(pointClearTimerRef.current);
          }
          pointClearTimerRef.current = window.setTimeout(() => {
            pointClearTimerRef.current = null;
            setPointTarget(null);
            resumeMariaFollowing();
          }, POINT_HOLD_MS);
        }
      }

      if (event.type === "assistant-reply") {
        setAssistantNote(event.reply || event.message || "Maria replied.");
        speakAssistantReply(event);
      }

      if (event.type === "policy-response" || event.type === "command-blocked") {
        setAssistantNote(event.message || "Maria cannot help with that request.");
      }

      if (event.type === "command-stopped") {
        setIsMariaStarted(false);
        setIsBusy(false);
        setIsListening(false);
        setPointTarget(null);
        setAllowWake(false);
        setStatus("Ready");
        setAssistantNote(event.message || "Maria stopped.");
      }

      if (event.type === "wake-word-detected") {
        triggerAttentionFlash();
        if (!event.command) {
          setStatus("Heard wake word");
        }
      }
    });

    return () => {
      unsubscribeStatus?.();
      unsubscribeEvents?.();
    };
  }, [animateOverlayPosition, handleAction, handleMariaButton, resumeMariaFollowing, speakAssistantReply, triggerAttentionFlash]);

  useEffect(() => {
    const bridge = getMariaBridge();
    if (!bridge) {
      return;
    }

    let active = true;
    let currentController: AbortController | null = null;

    const pollAutomatonAlerts = async () => {
      currentController?.abort();
      const controller = new AbortController();
      currentController = controller;

      try {
        const token = await getIdToken();
        if (!token || !active || controller.signal.aborted) {
          return;
        }

        const response = await fetch("/api/assistant/alerts?unreadOnly=true&source=automaton&limit=1", {
          headers: { Authorization: `Bearer ${token}` },
          signal: controller.signal,
        });
        if (!response.ok) {
          return;
        }

        const alert = readAutomatonAlert(await readJson(response));
        if (!active || !alert || latestAutomatonAlertIdRef.current === alert.id) {
          return;
        }

        latestAutomatonAlertIdRef.current = alert.id;
        setStatus("Automaton update");
        setIsBusy(false);
        setAssistantNote(alert.summary || alert.message_text || alert.title || "Automaton has an update.");
      } catch (error) {
        if (!active || controller.signal.aborted) {
          return;
        }
        log.warn("Automaton alert polling failed:", error);
      }
    };

    void pollAutomatonAlerts();
    const intervalId = window.setInterval(() => {
      void pollAutomatonAlerts();
    }, 60_000);

    return () => {
      active = false;
      currentController?.abort();
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    const Recognition = getSpeechRecognition();
    if (!Recognition || !allowWake || isListening) {
      stopCurrentRecognition();
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
        if (mounted && allowWake && !isListening) {
          startRecognition();
        }
      }, delayMs);
    };

    const disableRecognition = (nextStatus: string) => {
      mounted = false;
      clearRestartTimer();
      setAllowWake(false);
      setStatus(nextStatus);
      stopCurrentRecognition();
    };

    const startRecognition = () => {
      if (!mounted || recognitionRef.current) {
        return;
      }

      try {
        const recognition = new Recognition();
        recognition.lang = "en-US";
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        recognition.onresult = (event) => {
          wakeRecognitionFailureCountRef.current = 0;
          const transcript = readTranscript(event);
          const normalized = transcript.toLowerCase();
          const wakeIndex = normalized.lastIndexOf("hey maria");
          if (wakeIndex === -1) {
            return;
          }

          const command = transcript.slice(wakeIndex + "hey maria".length).replace(/^[,.:;!?\s-]+/, "").trim();
          triggerAttentionFlash();
          if (command) {
            void handleAction(command);
          } else {
            setStatus("Heard wake word");
          }
        };

        recognition.onend = () => {
          if (recognitionRef.current === recognition) {
            recognitionRef.current = null;
          }
          if (mounted && allowWake && !isListening) {
            scheduleRecognitionRestart(nextRestartDelayMs);
            nextRestartDelayMs = 500;
          }
        };

        recognition.onerror = (event) => {
          const errorCode = getSpeechRecognitionErrorCode(event);

          if (errorCode === "no-speech") {
            nextRestartDelayMs = 750;
            return;
          }

          if (errorCode === "aborted" || errorCode === "network") {
            wakeRecognitionFailureCountRef.current += 1;
            if (wakeRecognitionFailureCountRef.current >= 3) {
              disableRecognition("Wake word unavailable");
            } else {
              nextRestartDelayMs = 1000 * wakeRecognitionFailureCountRef.current;
            }
            return;
          }

          if (errorCode === "not-allowed" || errorCode === "service-not-allowed" || errorCode === "audio-capture") {
            disableRecognition(errorCode === "audio-capture" ? "Microphone unavailable" : "Microphone permission needed");
            return;
          }

          log.warn("[MariaOverlay] Wake recognition stopped", errorCode);
          disableRecognition("Wake word unavailable");
        };

        recognition.start();
        recognitionRef.current = recognition;
      } catch (error) {
        log.error("Failed to start Maria wake recognition:", error);
        setStatus("Wake word unavailable");
      }
    };

    startRecognition();

    return () => {
      mounted = false;
      clearRestartTimer();
      stopCurrentRecognition();
    };
  }, [allowWake, handleAction, isListening, stopCurrentRecognition, triggerAttentionFlash]);

  return (
    <div
      className={containerClassName}
      draggable={false}
      onMouseDown={(event) => {
        if (!isMariaInteractiveEventTarget(event.target)) {
          event.preventDefault();
        }
      }}
      onTouchStart={(event) => {
        if (!isMariaInteractiveEventTarget(event.target)) {
          event.preventDefault();
        }
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <button
        ref={mariaButtonRef}
        type="button"
        draggable={false}
        data-maria-interactive="true"
        data-maria-hitbox="circle"
        aria-label={isMariaActive ? "Drag Maria or click to stop" : "Drag Maria or click to start"}
        aria-pressed={isMariaActive}
        className={mariaIconClassName}
        onContextMenu={(event) => event.preventDefault()}
        onPointerEnter={() => {
          setIsFollowing(false);
          setMariaMousePassthrough(false);
        }}
        onPointerMove={handleMariaPointerMove}
        onPointerDown={handleMariaPointerDown}
        onPointerUp={finishMariaDrag}
        onPointerLeave={enableIdleMariaMousePassthrough}
        onPointerCancel={finishMariaDrag}
        onClick={handleMariaButton}
      >
        <span className={styles.iconGlow} />
        <MousePointer2 size={18} aria-hidden />
      </button>

      {shouldShowPrompt ? (
        <div className={styles.promptBubble} data-maria-interactive="true" aria-live="polite">
          <span className={styles.promptHeader}>
            <span className={styles.promptMeta}>
              {isPointing ? (
                <span className={styles.speakingDot} aria-hidden />
              ) : isMariaListening ? (
                <span className={styles.waveform} aria-hidden>
                  {MARIA_WAVEFORM_LEVELS.map((level, index) => (
                    <span
                      key={index}
                      className={styles.waveformBar}
                      style={{ height: `${5 + Math.max(mariaInputLevel, 0.08) * level * 18}px` }}
                    />
                  ))}
                </span>
              ) : isMariaThinking ? (
                <span className={styles.promptSpinner} aria-hidden />
              ) : isMariaSpeaking ? (
                <span className={styles.speakingDot} aria-hidden />
              ) : null}
              <span className={styles.promptStatus}>{isPointing ? "Pointing" : status}</span>
            </span>
            {isMariaActive ? (
              <button
                type="button"
                className={styles.promptStopButton}
                data-maria-interactive="true"
                aria-label="Stop Maria"
                title="Stop Maria"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void forceStopMaria();
                }}
              >
                <Square size={10} fill="currentColor" strokeWidth={2.5} aria-hidden />
              </button>
            ) : null}
          </span>
          <span className={styles.promptText}>
            {pointTarget ? pointTarget.spokenText || `Pointing at ${pointTarget.label}.` : assistantNote}
          </span>
        </div>
      ) : null}
    </div>
  );
}
