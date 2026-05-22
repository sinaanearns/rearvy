"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./clicky.module.css";
import { MousePointer2, Mic, Play, Search, Sparkles } from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";

export default function ClickyPage() {
  const [isOpen, setIsOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const [assistantNote, setAssistantNote] = useState("Firecrawl research is ready when you ask for it.");
  const [assistantResults, setAssistantResults] = useState<Array<{ title: string; url: string; description: string; summary: string }>>([]);
  const lastWindowSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any | null>(null);

  const lookupWorkbookContext = async (query: string) => {
    try {
      const token = await getIdToken();
      if (!token) {
        return [] as Array<{ title: string; url: string; description: string; summary: string }>;
      }

      const response = await fetch(`/api/integrations/excel/search?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return [] as Array<{ title: string; url: string; description: string; summary: string }>;
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
      return [] as Array<{ title: string; url: string; description: string; summary: string }>;
    }
  };

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

  const handleResearch = async (query: string) => {
    try {
      setLastCommand(query);
      if ((window as any).electron?.clicky?.research) {
        await (window as any).electron.clicky.research(query);
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to research with clicky:", err);
      setStatus("Error");
    }
  };

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
    "Research latest campaign metrics",
    "Summarize what is on this screen",
    "Guide me through the next step",
  ];

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

  const handleToggle = () => {
    setIsOpen(!isOpen);
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

          <div className={styles.researchCard}>
            <div className={styles.transcriptLabel}>Assistant note</div>
            <div className={styles.researchNote}>{assistantNote}</div>
            {assistantResults.length > 0 && (
              <div className={styles.researchList}>
                {assistantResults.map((result) => (
                  <a key={result.url || result.title} className={styles.researchItem} href={result.url} target="_blank" rel="noreferrer">
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
              <button
                key={action}
                type="button"
                className={styles.actionBtn}
                onClick={() => (action.startsWith("Research") ? handleResearch(action) : handleAction(action))}
              >
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
