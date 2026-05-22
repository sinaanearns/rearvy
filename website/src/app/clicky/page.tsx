"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./clicky.module.css";
import { MousePointer2, Mic, Play, Search, Sparkles } from "lucide-react";

export default function ClickyPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const lastWindowSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any | null>(null);

  // Prevent all drag events to stop page from dragging
  useEffect(() => {
    const preventDrag = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };

    const preventMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest(`.${styles.clickyContainer}`)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    const preventTouchMove = (e: TouchEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest(`.${styles.clickyContainer}`)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
      }
    };

    document.addEventListener('dragstart', preventDrag, true);
    document.addEventListener('dragend', preventDrag, true);
    document.addEventListener('drag', preventDrag, true);
    document.addEventListener('dragover', preventDrag, true);
    document.addEventListener('drop', preventDrag, true);
    document.addEventListener('mousedown', preventMouseDown, true);
    document.addEventListener('touchmove', preventTouchMove, { passive: false, capture: true });

    return () => {
      document.removeEventListener('dragstart', preventDrag, true);
      document.removeEventListener('dragend', preventDrag, true);
      document.removeEventListener('drag', preventDrag, true);
      document.removeEventListener('dragover', preventDrag, true);
      document.removeEventListener('drop', preventDrag, true);
      document.removeEventListener('mousedown', preventMouseDown, true);
      document.removeEventListener('touchmove', preventTouchMove);
    };
  }, []);

  // Persist wake-word preference
  useEffect(() => {
    try {
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  // Wake-word speech recognition (listen for "hey clicky <command>")
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    let mounted = true;

    const startRecognition = () => {
      try {
        const rec = new SpeechRecognition();
        rec.lang = "en-US";
        rec.continuous = true;
        rec.interimResults = false;

        rec.onresult = (e: any) => {
          try {
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
          console.error("Speech recognition error", err);
          setStatus("Wakeword error");
        };

        rec.start();
        recognitionRef.current = rec;
      } catch (err) {
        console.error("Failed to start speech recognition", err);
        setStatus("Wakeword unavailable");
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
    "Search latest campaign metrics",
    "Summarize what is on this screen",
    "Guide me through the next step",
  ];

  // Keep Clicky near cursor when collapsed
  useEffect(() => {
    if (isOpen) return;

    const interval = setInterval(async () => {
      if ((window as any).electron) {
        const mousePos = await (window as any).electron.clicky.getMousePosition();
        (window as any).electron.clicky.setPosition(mousePos.x + 18, mousePos.y + 18);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Resize transparent window based on panel state.
  useEffect(() => {
    const targetSize = isOpen
      ? { width: 420, height: 560 }
      : { width: 108, height: 108 };

    if ((window as any).electron) {
      const lastSize = lastWindowSizeRef.current;
      if (!lastSize || lastSize.width !== targetSize.width || lastSize.height !== targetSize.height) {
        (window as any).electron.clicky.setSize(targetSize.width, targetSize.height);
        lastWindowSizeRef.current = targetSize;
      }
    }
  }, [isOpen]);

  // Listen for status updates from the desktop brain bridge.
  useEffect(() => {
    if ((window as any).electron) {
      const unsubscribe = (window as any).electron.clicky.onStatus((newStatus: string) => {
        setStatus(newStatus);
        setIsBusy(newStatus !== "Ready");
        if (newStatus !== "Ready") setLastCommand(newStatus);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleAction = async (action: string) => {
    try {
      setLastCommand(action);
      if ((window as any).electron) {
        await (window as any).electron.clicky.runCommand(action);
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to run clicky command:", err);
      setStatus("Error");
    }
  };

  const handleVoice = async () => {
    setIsListening((prev) => !prev);
    await handleAction("Voice Command");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    handleAction(inputText);
    setInputText("");
  };

  return (
    <div 
      className={styles.clickyContainer}
      draggable={false}
      onMouseDown={(e) => e.preventDefault()}
      onTouchStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <button
        type="button"
        draggable={false}
        aria-label="Toggle Clicky"
        className={`${styles.clickyIcon} ${isBusy ? styles.active : ''}`}
        onClick={handleToggle}
      >
        <span className={styles.iconGlow} />
        <MousePointer2 size={16} color="white" />
      </button>

      {isOpen && (
        <div className={styles.panel} draggable={false}>
          <div className={styles.header}>
            <div className={styles.titleRow}>
              <div className={styles.titleIcon}>
                <Sparkles size={12} color="#dbeafe" />
              </div>
              <div>
                <div className={styles.title}>Clicky for Rearvy</div>
                <div className={styles.subtitle}>Cursor-side AI buddy</div>
              </div>
            </div>
          </div>

          <div className={styles.transcript}>
            <div className={styles.transcriptLabel}>Latest action</div>
            <div className={styles.transcriptText}>{lastCommand}</div>
          </div>

          <form onSubmit={handleSubmit}>
            <input
              className={styles.input}
              placeholder="Ask Clicky to click, search, or explain..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              autoFocus
            />
          </form>

          <button
            type="button"
            className={`${styles.voiceBtn} ${isListening ? styles.voiceListening : ""}`}
            onClick={handleVoice}
          >
            <Mic size={14} />
            {isListening ? "Listening..." : "Push-to-talk mode"}
          </button>

          <button
            type="button"
            className={`${styles.wakeBtn} ${allowWake ? styles.wakeOn : ""}`}
            onClick={() => setAllowWake((prev) => !prev)}
            aria-pressed={allowWake}
          >
            {allowWake ? "Wake: On" : "Wake: Off"}
          </button>

          <div className={styles.actionGrid}>
            {quickActions.map((action, index) => (
              <button key={action} className={styles.actionBtn} onClick={() => handleAction(action)}>
                {index % 2 === 0 ? <Play size={12} /> : <Search size={12} />}
                {action}
              </button>
            ))}
          </div>

          <div className={styles.status}>
            <div className={styles.statusDot} style={{ background: isBusy ? "#f59e0b" : "#10b981" }} />
            {status}
          </div>
        </div>
      )}
    </div>
  );
}
