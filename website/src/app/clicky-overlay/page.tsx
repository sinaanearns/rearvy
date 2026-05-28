"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { MousePointer2 } from "lucide-react";
import {
  ClickyVoiceAgentError,
  ClickyVoiceAgentSession,
  getClickyVoiceAgentFailureMessage,
  type ClickyVoiceAgentStatus,
  type ClickyVoiceAgentToolRequest,
  type ClickyVoiceAgentToolResult,
} from "@/lib/clicky/voice-agent";
import { isScreenAnalysisRequest } from "@/lib/screen-intent";
import styles from "./clicky-overlay.module.css";

type MousePosition = { x: number; y: number };

type ClickyDragState = {
  pointerId: number;
  offsetX: number;
  offsetY: number;
  startX: number;
  startY: number;
  latestPosition: MousePosition;
  hasMoved: boolean;
};

type ClickyResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

type ClickyCommandPayload = {
  command: string;
  requestId: string;
  origin: "clicky-overlay" | "maria";
};

type ClickyCommandResult = {
  ok?: boolean;
  reply?: string;
  message?: string;
  error?: string;
};

type ClickyAssistantEvent =
  | { type: "command-stopped"; reason?: string; message?: string }
  | { type: "research-started"; query?: string }
  | { type: "research-completed"; headline?: string; results?: ClickyResult[] }
  | { type: "scrape-completed"; url?: string; result?: { title?: string; url?: string; summary?: string } }
  | { type: "screen-analysis-started"; command?: string; hasScreenshot?: boolean }
  | { type: "screen-analysis-completed"; command?: string; reply?: string }
  | { type: "screen-analysis-failed"; command?: string; message?: string }
  | { type: "screen-point"; command?: string; x?: number; y?: number; label?: string; spokenText?: string; screenNumber?: number | null }
  | { type: "assistant-reply"; reply?: string; message?: string }
  | { type: "policy-response" | "command-blocked"; message?: string }
  | { type: "wake-word-detected"; transcript?: string; command?: string };

type ClickyBridge = {
  setPosition: (x: number, y: number) => void;
  setSize: (width: number, height: number) => void;
  setMousePassthrough?: (passthrough: boolean) => void;
  getMousePosition: () => Promise<MousePosition>;
  runCommand: (command: string | ClickyCommandPayload) => Promise<unknown>;
  research?: (command: string | ClickyCommandPayload) => Promise<unknown>;
  stop?: () => Promise<unknown>;
  onStatus?: (callback: (status: unknown) => void) => () => void;
  onAssistantEvent?: (callback: (event: ClickyAssistantEvent) => void) => () => void;
};

type ClickyPointTarget = {
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

type ClickyWindow = Window &
  typeof globalThis & {
    electron?: {
      clicky?: ClickyBridge;
    };
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

const COLLAPSED_SIZE = { width: 108, height: 108 };
const TALK_SIZE = { width: 280, height: 154 };
const POINT_SIZE = { width: 280, height: 154 };
const FOLLOW_OFFSET = 22;
const FOLLOW_INTERVAL_MS = 70;
const DRAG_THRESHOLD_PX = 6;
const ATTENTION_FLASH_MS = 1200;
const POINT_HOLD_MS = 4800;
const CLICKY_INTERACTIVE_SELECTOR = "[data-clicky-interactive='true']";
const CLICKY_POSITION_STORAGE_KEY = "clicky.manualPosition";
const POINT_ICON_CENTER = { x: 237, y: 111 };
const MARIA_WAVEFORM_LEVELS = [0.42, 0.78, 1, 0.68, 0.5] as const;

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

function getClickyBridge() {
  return (window as ClickyWindow).electron?.clicky;
}

function createClickyPayload(
  command: string,
  requestId = crypto.randomUUID(),
  origin: ClickyCommandPayload["origin"] = "clicky-overlay"
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

function isClickyInteractiveTarget(target: Element | null, clientX: number, clientY: number) {
  const interactiveTarget = target?.closest(CLICKY_INTERACTIVE_SELECTOR);
  if (!interactiveTarget) {
    return false;
  }

  if (interactiveTarget.getAttribute("data-clicky-hitbox") !== "circle") {
    return true;
  }

  const bounds = interactiveTarget.getBoundingClientRect();
  const radius = Math.min(bounds.width, bounds.height) / 2;
  const centerX = bounds.left + bounds.width / 2;
  const centerY = bounds.top + bounds.height / 2;

  return Math.hypot(clientX - centerX, clientY - centerY) <= radius;
}

function isClickyInteractivePoint(clientX: number, clientY: number) {
  return isClickyInteractiveTarget(document.elementFromPoint(clientX, clientY), clientX, clientY);
}

function isClickyInteractiveEventTarget(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(CLICKY_INTERACTIVE_SELECTOR));
}

function readSavedClickyPosition(): MousePosition | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = localStorage.getItem(CLICKY_POSITION_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const value = JSON.parse(raw) as Partial<MousePosition>;
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

function saveClickyPosition(position: MousePosition) {
  try {
    localStorage.setItem(
      CLICKY_POSITION_STORAGE_KEY,
      JSON.stringify({ x: Math.round(position.x), y: Math.round(position.y) })
    );
  } catch {}
}

function getPointerScreenPosition(event: ReactPointerEvent<HTMLElement>): MousePosition {
  return { x: event.screenX, y: event.screenY };
}

export default function ClickyOverlayPage() {
  const [initialSavedPosition] = useState(() => readSavedClickyPosition());
  const [isFollowing, setIsFollowing] = useState(() => initialSavedPosition === null);
  const [isClickyStarted, setIsClickyStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [isDraggingClicky, setIsDraggingClicky] = useState(false);
  const [isAttentionFlashActive, setIsAttentionFlashActive] = useState(false);
  const [assistantNote, setAssistantNote] = useState("Ready near your cursor.");
  const [mariaInputLevel, setMariaInputLevel] = useState(0);
  const [pointTarget, setPointTarget] = useState<ClickyPointTarget | null>(null);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
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
  const dragStateRef = useRef<ClickyDragState | null>(null);
  const suppressClickUntilRef = useRef(0);
  const hasManualPositionRef = useRef(initialSavedPosition !== null);
  const voiceAgentSessionRef = useRef<ClickyVoiceAgentSession | null>(null);
  const voiceAgentStopRequestedRef = useRef(false);
  const voiceAgentSessionVersionRef = useRef(0);
  const isMousePassthroughRef = useRef<boolean | null>(null);
  const pointClearTimerRef = useRef<number | null>(null);

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
    try {
      recognitionRef.current?.stop();
    } catch {}

    recognitionRef.current = null;
  }, []);

  const setClickyMousePassthrough = useCallback((passthrough: boolean) => {
    if (isMousePassthroughRef.current === passthrough) {
      return;
    }

    getClickyBridge()?.setMousePassthrough?.(passthrough);
    isMousePassthroughRef.current = passthrough;
  }, []);

  const setOverlayPosition = useCallback((position: MousePosition) => {
    const nextPosition = {
      x: Math.round(position.x),
      y: Math.round(position.y),
    };

    lastWindowPositionRef.current = nextPosition;
    getClickyBridge()?.setPosition(nextPosition.x, nextPosition.y);
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

  const resetClickyMousePassthrough = useCallback(() => {
    setClickyMousePassthrough(false);
  }, [setClickyMousePassthrough]);

  const enableIdleClickyMousePassthrough = useCallback(() => {
    if (!dragStateRef.current) {
      setClickyMousePassthrough(true);
    }
  }, [setClickyMousePassthrough]);

  const resumeClickyFollowing = useCallback(() => {
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
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  useEffect(() => {
    if (!initialSavedPosition) {
      return;
    }

    setOverlayPosition(initialSavedPosition);
  }, [initialSavedPosition, setOverlayPosition]);

  useEffect(() => {
    const updateMousePassthrough = (event: MouseEvent) => {
      if (dragStateRef.current) {
        setClickyMousePassthrough(false);
        return;
      }

      setClickyMousePassthrough(!isClickyInteractivePoint(event.clientX, event.clientY));
    };

    enableIdleClickyMousePassthrough();
    document.addEventListener("mousemove", updateMousePassthrough, true);
    document.addEventListener("mouseleave", enableIdleClickyMousePassthrough, true);
    document.addEventListener("pointercancel", enableIdleClickyMousePassthrough, true);
    window.addEventListener("blur", enableIdleClickyMousePassthrough);

    return () => {
      document.removeEventListener("mousemove", updateMousePassthrough, true);
      document.removeEventListener("mouseleave", enableIdleClickyMousePassthrough, true);
      document.removeEventListener("pointercancel", enableIdleClickyMousePassthrough, true);
      window.removeEventListener("blur", enableIdleClickyMousePassthrough);
      resetClickyMousePassthrough();
    };
  }, [enableIdleClickyMousePassthrough, resetClickyMousePassthrough, setClickyMousePassthrough]);

  const forceStopClicky = useCallback(async () => {
    clickToTalkSessionRef.current += 1;
    setIsClickyStarted(false);
    setIsBusy(false);
    setIsListening(false);
    setMariaInputLevel(0);
    setPointTarget(null);
    resumeClickyFollowing();
    setAllowWake(false);
    setStatus("Ready");
    setAssistantNote("Clicky stopped.");

    voiceAgentStopRequestedRef.current = true;
    voiceAgentSessionVersionRef.current += 1;
    const voiceAgentSession = voiceAgentSessionRef.current;
    voiceAgentSessionRef.current = null;
    await voiceAgentSession?.stop().catch(() => undefined);
    stopCurrentRecognition();

    try {
      const bridge = getClickyBridge();
      if (bridge?.stop) {
        await bridge.stop();
        return;
      }

      await bridge?.runCommand?.({
        command: "stop",
        requestId: crypto.randomUUID(),
        origin: "clicky-overlay",
      });
    } catch (error) {
      console.error("Failed to stop Clicky:", error);
    }
  }, [resumeClickyFollowing, stopCurrentRecognition]);

  const handleAction = useCallback(async (action: string) => {
    const command = action.trim();
    if (!command) {
      return;
    }

    setAssistantNote(`Running: ${command}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      const bridge = getClickyBridge();
      if (bridge?.runCommand) {
        await bridge.runCommand(createClickyPayload(command, crypto.randomUUID(), "clicky-overlay"));
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

  const applyVoiceAgentStatus = useCallback((nextStatus: ClickyVoiceAgentStatus) => {
    setStatus(nextStatus);
    setIsBusy(
      nextStatus === "Connecting" ||
        nextStatus === "Maria thinking" ||
        nextStatus === "Maria speaking" ||
        nextStatus === "Running Clicky action"
    );
  }, []);

  const runVoiceAgentClickyTool = useCallback(async ({
    callId,
    command,
    mode,
  }: ClickyVoiceAgentToolRequest): Promise<ClickyVoiceAgentToolResult> => {
    const requestId = callId || crypto.randomUUID();
    const payload = createClickyPayload(command, requestId, "maria");
    setAssistantNote(`Running Clicky action: ${command}`);
    setStatus("Running Clicky action");
    setIsBusy(true);

    try {
      const clicky = getClickyBridge();
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
      return {
        ok: false,
        message: "Desktop bridge unavailable.",
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("Failed to run AssemblyAI Clicky tool:", error);
      setStatus("Error");
      setAssistantNote("Clicky could not run that action.");
      return {
        ok: false,
        message,
      };
    } finally {
      setIsBusy(false);
    }
  }, []);

  const startClicky = useCallback(async () => {
    if (voiceAgentSessionRef.current) {
      return;
    }

    const sessionId = clickToTalkSessionRef.current + 1;
    clickToTalkSessionRef.current = sessionId;
    const voiceSessionVersion = voiceAgentSessionVersionRef.current + 1;
    voiceAgentSessionVersionRef.current = voiceSessionVersion;
    const isCurrentVoiceSession = () => voiceAgentSessionVersionRef.current === voiceSessionVersion;

    setIsClickyStarted(true);
    setIsFollowing(false);
    setIsListening(true);
    setStatus("Connecting");
    setAssistantNote("Connecting AssemblyAI Voice Agent...");
    triggerAttentionFlash();
    stopCurrentRecognition();

    const session = new ClickyVoiceAgentSession({
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

        return await runVoiceAgentClickyTool(request);
      },
      onError: (message, error) => {
        if (!isCurrentVoiceSession()) {
          return;
        }

        console.warn("[ClickyVoiceAgent] Overlay error", error);
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
        (error instanceof ClickyVoiceAgentError && error.code === "voice_agent_disconnected")
      ) {
        voiceAgentStopRequestedRef.current = false;
        setAssistantNote("AssemblyAI Voice Agent disconnected.");
        setStatus("Disconnected");
      } else {
        console.warn("[ClickyVoiceAgent] Overlay failed to start", error);
        setAssistantNote(getClickyVoiceAgentFailureMessage(error));
        setStatus("Voice Agent unavailable");
      }

      if (voiceAgentSessionRef.current === session) {
        voiceAgentSessionRef.current = null;
      }
      await session.stop().catch(() => undefined);
      setIsClickyStarted(false);
      setIsListening(false);
      setMariaInputLevel(0);
      resumeClickyFollowing();
      setIsBusy(false);
    }
  }, [
    applyVoiceAgentStatus,
    resumeClickyFollowing,
    runVoiceAgentClickyTool,
    stopCurrentRecognition,
    triggerAttentionFlash,
  ]);

  const handleClickyPointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || !isClickyInteractiveTarget(event.currentTarget, event.clientX, event.clientY)) {
      return;
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

    setClickyMousePassthrough(false);
    setIsFollowing(false);
    event.currentTarget.setPointerCapture(event.pointerId);
  }, [setClickyMousePassthrough]);

  const handleClickyPointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      setIsFollowing(false);
      setClickyMousePassthrough(false);
      return;
    }

    event.preventDefault();
    const pointerPosition = getPointerScreenPosition(event);
    const distance = Math.hypot(pointerPosition.x - dragState.startX, pointerPosition.y - dragState.startY);
    const nextPosition = {
      x: pointerPosition.x - dragState.offsetX,
      y: pointerPosition.y - dragState.offsetY,
    };

    dragState.latestPosition = nextPosition;

    if (!dragState.hasMoved && distance >= DRAG_THRESHOLD_PX) {
      dragState.hasMoved = true;
      hasManualPositionRef.current = true;
      setIsDraggingClicky(true);
    }

    if (dragState.hasMoved) {
      setOverlayPosition(nextPosition);
    }

    setIsFollowing(false);
    setClickyMousePassthrough(false);
  }, [setClickyMousePassthrough, setOverlayPosition]);

  const finishClickyDrag = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) {
      enableIdleClickyMousePassthrough();
      return;
    }

    dragStateRef.current = null;
    setIsDraggingClicky(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (dragState.hasMoved) {
      event.preventDefault();
      event.stopPropagation();
      suppressClickUntilRef.current = performance.now() + 250;
      hasManualPositionRef.current = true;
      setIsFollowing(false);
      saveClickyPosition(dragState.latestPosition);
    }

    enableIdleClickyMousePassthrough();
  }, [enableIdleClickyMousePassthrough]);

  const handleClickyButton = useCallback(() => {
    if (performance.now() < suppressClickUntilRef.current) {
      return;
    }

    if (isClickyStarted || isBusy || isListening) {
      void forceStopClicky();
      return;
    }

    void startClicky();
  }, [forceStopClicky, isBusy, isClickyStarted, isListening, startClicky]);

  const isClickyActive = isClickyStarted || isBusy || isListening;
  const isPointing = Boolean(pointTarget);
  const shouldShowPrompt = isClickyActive || isPointing;
  const isMariaListening = status === "Maria listening";
  const isMariaThinking = status === "Connecting" || status === "Maria thinking" || status === "Running Clicky action";
  const isMariaSpeaking = status === "Maria speaking";
  const containerClassName = [
    styles.clickyContainer,
    shouldShowPrompt ? styles.withPrompt : "",
    isPointing ? styles.pointing : "",
  ]
    .filter(Boolean)
    .join(" ");

  useEffect(() => {
    const targetSize = isPointing ? POINT_SIZE : isClickyActive ? TALK_SIZE : COLLAPSED_SIZE;
    const lastSize = lastWindowSizeRef.current;
    if (lastSize.width === targetSize.width && lastSize.height === targetSize.height) {
      return;
    }

    getClickyBridge()?.setSize(targetSize.width, targetSize.height);
    lastWindowSizeRef.current = targetSize;
  }, [isClickyActive, isPointing]);

  useEffect(() => {
    if (!isFollowing || isClickyActive || isPointing) {
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
        setOverlayPosition({ x: mousePosition.x + FOLLOW_OFFSET, y: mousePosition.y + FOLLOW_OFFSET });
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
  }, [isClickyActive, isFollowing, isPointing, setOverlayPosition]);

  useEffect(() => {
    const bridge = getClickyBridge();
    if (!bridge?.onStatus && !bridge?.onAssistantEvent) {
      return;
    }

    const unsubscribeStatus = bridge.onStatus?.((newStatus) => {
      const nextStatus = String(newStatus || "Ready");
      setStatus(nextStatus);
      setIsBusy(nextStatus !== "Ready");
    });

    const unsubscribeEvents = bridge.onAssistantEvent?.((event) => {
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
        setAssistantNote(event.message || "Clicky could not capture the screen.");
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
            resumeClickyFollowing();
          }, POINT_HOLD_MS);
        }
      }

      if (event.type === "assistant-reply") {
        setAssistantNote(event.reply || event.message || "Clicky replied.");
      }

      if (event.type === "policy-response" || event.type === "command-blocked") {
        setAssistantNote(event.message || "Clicky cannot help with that request.");
      }

      if (event.type === "command-stopped") {
        setIsClickyStarted(false);
        setIsBusy(false);
        setIsListening(false);
        setPointTarget(null);
        setAllowWake(false);
        setStatus("Ready");
        setAssistantNote(event.message || "Clicky stopped.");
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
  }, [animateOverlayPosition, resumeClickyFollowing, triggerAttentionFlash]);

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
          const wakeIndex = normalized.lastIndexOf("hey clicky");
          if (wakeIndex === -1) {
            return;
          }

          const command = transcript.slice(wakeIndex + "hey clicky".length).replace(/^[,.:;!?\s-]+/, "").trim();
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

          console.warn("[ClickyOverlay] Wake recognition stopped", errorCode);
          disableRecognition("Wake word unavailable");
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
      clearRestartTimer();
      stopCurrentRecognition();
    };
  }, [allowWake, handleAction, isListening, stopCurrentRecognition, triggerAttentionFlash]);

  return (
    <div
      className={containerClassName}
      draggable={false}
      onMouseDown={(event) => {
        if (!isClickyInteractiveEventTarget(event.target)) {
          event.preventDefault();
        }
      }}
      onTouchStart={(event) => {
        if (!isClickyInteractiveEventTarget(event.target)) {
          event.preventDefault();
        }
      }}
      onDragStart={(event) => event.preventDefault()}
    >
      <button
        type="button"
        draggable={false}
        data-clicky-interactive="true"
        data-clicky-hitbox="circle"
        aria-label={isClickyActive ? "Drag Clicky or click to stop" : "Drag Clicky or click to start"}
        aria-pressed={isClickyActive}
        className={`${styles.clickyIcon} ${isClickyActive ? styles.active : ""} ${
          isAttentionFlashActive ? styles.attention : ""
        } ${isDraggingClicky ? styles.dragging : ""} ${isPointing ? styles.pointIcon : ""}`}
        onContextMenu={(event) => event.preventDefault()}
        onPointerEnter={() => {
          setIsFollowing(false);
          setClickyMousePassthrough(false);
        }}
        onPointerMove={handleClickyPointerMove}
        onPointerDown={handleClickyPointerDown}
        onPointerUp={finishClickyDrag}
        onPointerLeave={enableIdleClickyMousePassthrough}
        onPointerCancel={finishClickyDrag}
        onClick={handleClickyButton}
      >
        <span className={styles.iconGlow} />
        <MousePointer2 size={18} aria-hidden />
      </button>

      {shouldShowPrompt ? (
        <div className={styles.promptBubble} aria-live="polite">
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
          <span className={styles.promptText}>
            {pointTarget ? pointTarget.spokenText || `Pointing at ${pointTarget.label}.` : assistantNote}
          </span>
        </div>
      ) : null}
    </div>
  );
}
