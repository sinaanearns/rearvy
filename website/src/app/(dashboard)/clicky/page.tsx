"use client";

import React, { useEffect, useRef, useState } from "react";
import { Mic, MousePointer2, Play, Search, Sparkles } from "lucide-react";
import { getIdToken } from "@/lib/firebase/auth";

type ClickyResult = {
  title: string;
  url: string;
  description: string;
  summary: string;
};

export default function ClickyPage() {
  const [inputText, setInputText] = useState("");
  const [status, setStatus] = useState("Ready");
  const [isBusy, setIsBusy] = useState(false);
  const [lastCommand, setLastCommand] = useState("Waiting for instructions");
  const [assistantNote, setAssistantNote] = useState("Clicky is available in the sidebar and as a cursor-following desktop bubble.");
  const [assistantResults, setAssistantResults] = useState<ClickyResult[]>([]);
  const [allowWake, setAllowWake] = useState<boolean>(() => {
    try {
      return localStorage.getItem("clicky.allowWake") === "true";
    } catch {
      return false;
    }
  });
  const recognitionRef = useRef<any | null>(null);

  const lookupWorkbookContext = async (query: string): Promise<ClickyResult[]> => {
    try {
      const token = await getIdToken();
      if (!token) {
        return [];
      }

      const response = await fetch(`/api/integrations/excel/search?q=${encodeURIComponent(query)}&limit=5`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        return [];
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
      return [];
    }
  };

  // Persist wake-word preference
  useEffect(() => {
    try {
      localStorage.setItem("clicky.allowWake", allowWake ? "true" : "false");
    } catch {}
  }, [allowWake]);

  const handleAction = async (action: string) => {
    setLastCommand(action);
    setAssistantNote(`Running: ${action}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      if ((window as any).electron?.clicky?.runCommand) {
        await (window as any).electron.clicky.runCommand(action);
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to run clicky command:", err);
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  const handleResearch = async (query: string) => {
    setLastCommand(query);
    setAssistantNote(`Researching: ${query}`);
    setStatus("Working");
    setIsBusy(true);

    try {
      if ((window as any).electron?.clicky?.research) {
        await (window as any).electron.clicky.research(query);
      } else {
        setStatus("Desktop bridge unavailable");
      }
    } catch (err) {
      console.error("Failed to research with clicky:", err);
      setStatus("Error");
    } finally {
      setIsBusy(false);
    }
  };

  // Wake-word speech recognition (listen for "hey clicky <command>")
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition || !allowWake) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.onend = null;
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      return;
    }

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
                setAssistantNote(`Voice command received: ${cmd}`);
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

  // Listen for status updates from the desktop brain bridge.
  useEffect(() => {
    if ((window as any).electron?.clicky) {
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText) return;
    void handleAction(inputText);
    setInputText("");
  };

  return (
    <div className="flex min-h-[calc(100vh-6rem)] w-full flex-col gap-6 px-4 py-5 md:px-6">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-600 text-white shadow-lg shadow-blue-600/25">
            <MousePointer2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-950 dark:text-white">Clicky</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Sidebar voice and command control for Rearvy, with a cursor-following desktop bubble.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <span className={`h-2 w-2 rounded-full ${isBusy ? "bg-amber-500" : "bg-emerald-500"}`} />
            {status}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            {allowWake ? "Wake word enabled" : "Wake word disabled"}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            {lastCommand}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,0.75fr)]">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Command Center</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Type a command, use a quick action, or speak to Clicky while this page is open.
              </p>
            </div>
            <button
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm transition-colors ${
                allowWake
                  ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-200"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              }`}
              onClick={() => setAllowWake((current) => !current)}
              aria-pressed={allowWake}
            >
              <Mic className="h-4 w-4" />
              {allowWake ? "Disable wake word" : "Enable wake word"}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <textarea
              className="min-h-28 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-950 outline-none transition-colors placeholder:text-slate-400 focus:border-blue-400 focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500 dark:focus:bg-slate-950"
              placeholder="Ask Clicky to click, search, explain, or open something..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                className="inline-flex items-center gap-2 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-500 disabled:opacity-60"
                disabled={!inputText.trim()}
              >
                <Play className="h-4 w-4" />
                Send command
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleAction("Open Shopify dashboard")}
              >
                <Sparkles className="h-4 w-4" />
                Quick open
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
                onClick={() => void handleResearch("Research latest campaign metrics")}
              >
                <Search className="h-4 w-4" />
                Quick research
              </button>
            </div>
          </form>

          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((action) => (
              <button
                key={action}
                type="button"
                className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm text-slate-700 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
                onClick={() => (action.startsWith("Research") ? void handleResearch(action) : void handleAction(action))}
              >
                {action}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => void handleAction("Speak to Clicky")}
            className="inline-flex items-center gap-2 rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-blue-900 dark:hover:bg-blue-950/40 dark:hover:text-blue-200"
          >
            <Mic className="h-4 w-4" />
            Speak to Clicky
          </button>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Assistant Feed</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Command history and any research or workbook context that Clicky returns.
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Assistant note
            </div>
            <div className="mt-2 text-sm text-slate-800 dark:text-slate-100">{assistantNote}</div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
              Results
            </div>

            {assistantResults.length > 0 ? (
              <div className="mt-3 space-y-3">
                {assistantResults.map((result) => (
                  <a
                    key={result.url || result.title}
                    href={result.url || undefined}
                    target={result.url ? "_blank" : undefined}
                    rel={result.url ? "noreferrer" : undefined}
                    className="block rounded-2xl border border-slate-200 bg-white p-3 transition-colors hover:border-blue-300 hover:bg-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-900 dark:hover:bg-blue-950/40"
                  >
                    <div className="text-sm font-semibold text-slate-950 dark:text-white">{result.title}</div>
                    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{result.summary || result.description}</div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-slate-500 dark:text-slate-400">
                No results yet. Use a research action or ask Clicky to inspect something.
              </div>
            )}
          </div>

          <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:text-slate-300">
            <span>Desktop bridge</span>
            <span className={isBusy ? "text-amber-600 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}>
              {isBusy ? "Working" : "Ready"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
