"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, StopCircle, RefreshCw, Terminal, Globe } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BrowserLiveViewerProps {
  sessionId: string;
  allowManualControl?: boolean;
  onClose?: () => void;
}

export function BrowserLiveViewer({
  sessionId,
  allowManualControl = true,
  onClose,
}: BrowserLiveViewerProps) {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [command, setCommand] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchSession = async () => {
    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`);
      if (!res.ok) throw new Error("Failed to fetch session");
      const data = await res.json();
      setSession(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
    const interval = setInterval(fetchSession, 2000);
    return () => clearInterval(interval);
  }, [sessionId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session?.stdout, session?.stderr]);

  const handleStop = async () => {
    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Browser session stopped");
        if (onClose) onClose();
      }
    } catch (err) {
      toast.error("Failed to stop session");
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || sending) return;

    setSending(true);
    try {
      const res = await fetch(`/api/browser/sessions/${sessionId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command }),
      });
      if (res.ok) {
        setCommand("");
        fetchSession();
      } else {
        toast.error("Failed to send command");
      }
    } catch (err) {
      toast.error("Error sending command");
    } finally {
      setSending(false);
    }
  };

  if (loading && !session) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="p-8 text-center text-red-500">
        <p>Error: {error}</p>
        <Button onClick={fetchSession} className="mt-4" variant="outline">
          Retry
        </Button>
      </div>
    );
  }

  const logs = [...(session?.stdout || []), ...(session?.stderr || [])];

  const extractUrl = (text: string) => {
    if (!text) return null;
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const matches = text.match(urlRegex);
    return matches ? matches[0] : null;
  };

  const url = extractUrl(session?.task);

  return (
    <Card className="flex h-full flex-col overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between border-b border-border/50 bg-muted/30 py-3 px-4">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-sky-500" />
          <CardTitle className="text-sm font-semibold tracking-tight">
            Live Browser Session
          </CardTitle>
          {session?.isRunning ? (
            <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          ) : (
            <span className="flex h-2 w-2 rounded-full bg-slate-500" />
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={fetchSession}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleStop}
            disabled={!session?.isRunning}
            className="h-8 w-8 text-muted-foreground hover:text-red-500"
          >
            <StopCircle className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-0 overflow-hidden">
        {url && (
          <div className="flex-1 flex flex-col border-b border-border/50 min-h-[50%]">
            <div className="bg-muted/30 px-3 py-1.5 border-b border-border/50 text-xs font-mono truncate text-muted-foreground flex items-center gap-2">
              <Globe className="h-3 w-3" />
              {url}
            </div>
            {/* @ts-expect-error - webview is an Electron specific tag enabled in main.cjs */}
            <webview 
              src={url} 
              className="flex-1 w-full border-none bg-white" 
              title="Live Browser DOM"
            />
          </div>
        )}
        <div className={cn("overflow-y-auto p-4 font-mono text-xs", url ? "h-40 min-h-40" : "flex-1")} ref={scrollRef}>
          <div className="space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={cn(
                "break-words",
                log.startsWith("__EXIT_CODE__") ? "text-slate-500 italic" : "text-slate-300"
              )}>
                <span className="text-slate-500 mr-2">[{i}]</span>
                {log}
              </div>
            ))}
          </div>
        </div>

        {allowManualControl && session?.isRunning && (
          <div className="border-t border-border/50 bg-muted/20 p-3">
            <form onSubmit={handleSendCommand} className="flex gap-2">
              <div className="relative flex-1">
                <Terminal className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <input
                  type="text"
                  value={command}
                  onChange={(e) => setCommand(e.target.value)}
                  placeholder="Type a command (e.g. 'click Login')"
                  className="w-full rounded-md border border-border/50 bg-background/50 py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-sky-500"
                  disabled={sending}
                />
              </div>
              <Button type="submit" size="sm" disabled={sending || !command.trim()} className="bg-sky-500 hover:bg-sky-600 text-white">
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Send"}
              </Button>
            </form>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
