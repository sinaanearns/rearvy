"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, X, Focus, Monitor } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrowserSession {
  sessionId: string;
  browserSessionId?: string;
  task?: string;
  status?: string;
  summary?: string;
}

interface BrowserMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface BrowserFocusChatProps {
  sessions?: BrowserSession[];
  currentSessionId?: string;
  onSessionChange?: (sessionId: string) => void;
  onSendCommand?: (command: string, sessionId: string) => void;
  isLoading?: boolean;
  className?: string;
}

export function BrowserFocusChat({
  sessions = [],
  currentSessionId,
  onSessionChange,
  onSendCommand,
  isLoading = false,
  className,
}: BrowserFocusChatProps) {
  const [messages, setMessages] = useState<BrowserMessage[]>([]);
  const [input, setInput] = useState("");
  const [activeSession, setActiveSession] = useState<string | null>(
    currentSessionId || sessions[0]?.sessionId || null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);



  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !activeSession) return;

    const userMessage: BrowserMessage = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: input,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    onSendCommand?.(input, activeSession);

    const assistantMessage: BrowserMessage = {
      id: `msg-${Date.now()}-assistant`,
      role: "assistant",
      content: "Executing command...",
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  const handleSessionSelect = (sessionId: string) => {
    setActiveSession(sessionId);
    onSessionChange?.(sessionId);
    setMessages([]);
  };

  const currentSession = sessions.find((s) => s.sessionId === activeSession);

  return (
    <div className={cn("flex h-full flex-col bg-background/95", className)}>
      {/* Browser List / Selector */}
      <div className="border-b border-border/70 bg-background/95 px-3 py-2">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            <Focus className="mr-1 inline h-3 w-3" />
            Active Browser
          </p>
          <span className="text-[11px] text-muted-foreground">
            {sessions.length} session{sessions.length !== 1 ? "s" : ""}
          </span>
        </div>

        {sessions.length > 0 ? (
          <div className="space-y-1">
            {sessions.map((session) => {
              const isActive = session.sessionId === activeSession;
              return (
                <button
                  key={session.sessionId}
                  onClick={() => handleSessionSelect(session.sessionId)}
                  className={cn(
                    "w-full rounded-lg border px-2.5 py-2 text-left text-xs transition-colors",
                    isActive
                      ? "border-sky-500/50 bg-sky-500/10 shadow-sm"
                      : "border-border/70 bg-background/60 hover:bg-background/80"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Monitor className="h-3 w-3 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">
                        {session.task || "Browser"}
                      </div>
                      {session.status && (
                        <div className="truncate text-[10px] text-muted-foreground/70">
                          {session.status}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No active browsers</p>
        )}
      </div>

      {/* Current Session Summary */}
      {currentSession && (
        <div className="border-b border-border/70 bg-background/80 px-3 py-2">
          <div className="rounded-lg border border-border/50 bg-background/60 px-2.5 py-1.5 text-xs">
            <p className="font-medium text-foreground">
              {currentSession.task || "Browser Task"}
            </p>
            {currentSession.summary && (
              <p className="mt-1 text-[11px] text-muted-foreground">
                {currentSession.summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Messages / Chat History */}
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {messages.length > 0 ? (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "rounded-lg px-3 py-2 text-sm",
                  msg.role === "user"
                    ? "ml-6 bg-sky-500/20 text-sky-100"
                    : "mr-6 bg-muted/40 text-muted-foreground"
                )}
              >
                <div className="text-[11px] font-medium opacity-70">
                  {msg.role === "user" ? "You" : "Browser"}
                </div>
                <div className="mt-1 break-words text-xs leading-relaxed">
                  {msg.content}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-center text-xs text-muted-foreground/60">
              Select a browser to start
              <br />
              giving commands
            </p>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-border/70 bg-background/95 p-3">
        {activeSession ? (
          <form onSubmit={handleSendCommand} className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., click sign in, type test@example.com"
              disabled={isLoading}
              className="flex-1 rounded-lg bg-background/60 text-xs"
            />
            <Button
              type="submit"
              size="sm"
              disabled={!input.trim() || isLoading}
              className="shrink-0"
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </form>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            No browser selected
          </p>
        )}
      </div>
    </div>
  );
}
