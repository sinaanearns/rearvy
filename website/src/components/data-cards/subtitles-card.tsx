"use client";

import { useState } from "react";
import { AlertCircle, Check, Copy, Download, Film, Subtitles } from "lucide-react";
import { DataCardFrame, DataCardMessage } from "./data-card-frame";
import { formatSrtTimestamp } from "@/lib/ai/subtitles-generator";

type SubtitlesCardProps = {
  data: Record<string, unknown>;
};

type PreviewCue = {
  index: number;
  startTimeMs: number;
  endTimeMs: number;
  text: string;
  speaker?: string;
};

function readString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function readNumber(value: unknown, fallback: number) {
  return typeof value === "number" && !Number.isNaN(value) ? value : fallback;
}

export function SubtitlesCard({ data }: SubtitlesCardProps) {
  const [copiedScript, setCopiedScript] = useState(false);

  const ok = data.ok !== false;
  const title = readString(data.title) || "Auto Subtitle Generation";
  const message = readString(data.message);
  const cueCount = readNumber(data.cueCount, 0);
  const durationMs = readNumber(data.durationMs, 0);
  const maxCharsPerLine = readNumber(data.maxCharsPerLine, 37);
  const maxLines = readNumber(data.maxLines, 2);
  const srt = readString(data.srt);
  const vtt = readString(data.vtt);
  const daVinciScript = readString(data.daVinciScript);
  const previewCues = (Array.isArray(data.previewCues) ? data.previewCues : []) as PreviewCue[];

  if (!ok) {
    return (
      <DataCardMessage
        icon={AlertCircle}
        title="Subtitle Generation Failed"
        tone="rose"
        message={message || "I could not generate subtitles for this media."}
      />
    );
  }

  const durationSec = Math.round(durationMs / 1000);
  const durationFormatted =
    durationSec > 60
      ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s`
      : `${durationSec}s`;

  const handleDownloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyScript = () => {
    if (daVinciScript) {
      navigator.clipboard.writeText(daVinciScript);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  };

  return (
    <DataCardFrame
      icon={Subtitles}
      title={title}
      subtitle={`DaVinci Resolve Auto-Subs • ${cueCount} Cues`}
      tone="cyan"
      className="max-w-2xl animate-in fade-in zoom-in duration-300"
    >
      {/* Metrics Row */}
      <div className="grid gap-2 sm:grid-cols-4">
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Cues</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{cueCount}</p>
        </div>
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Duration</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">{durationFormatted}</p>
        </div>
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">Formatting</p>
          <p className="mt-1 truncate text-sm font-semibold text-foreground">
            {maxCharsPerLine} chars × {maxLines} lines
          </p>
        </div>
        <div className="rounded-[8px] border border-border/70 bg-background/78 p-3 dark:border-white/10 dark:bg-white/[0.04]">
          <p className="text-xs font-medium text-muted-foreground">DaVinci Resolve</p>
          <p className="mt-1 truncate text-sm font-semibold text-emerald-500">Timeline Sync Ready</p>
        </div>
      </div>

      {/* Cues Preview */}
      {previewCues.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground">Subtitle Preview</p>
          <div className="max-h-48 overflow-y-auto rounded-[8px] border border-border/70 bg-background/50 p-2.5 space-y-2 dark:border-white/10 dark:bg-black/20">
            {previewCues.map((cue) => (
              <div
                key={cue.index}
                className="flex flex-col gap-0.5 rounded p-1.5 text-xs bg-background/80 hover:bg-accent/40 transition"
              >
                <div className="flex items-center justify-between font-mono text-[11px] text-cyan-600 dark:text-cyan-400">
                  <span>
                    #{cue.index} [{formatSrtTimestamp(cue.startTimeMs)} → {formatSrtTimestamp(cue.endTimeMs)}]
                  </span>
                  {cue.speaker && (
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-sans">
                      {cue.speaker}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap font-medium text-foreground">{cue.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex flex-wrap items-center gap-2 pt-2 border-t border-border/50 dark:border-white/10">
        {srt && (
          <button
            type="button"
            onClick={() => handleDownloadFile(srt, "subtitles.srt", "text/plain")}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <Download className="h-3.5 w-3.5 text-cyan-500" />
            Download .SRT
          </button>
        )}
        {vtt && (
          <button
            type="button"
            onClick={() => handleDownloadFile(vtt, "subtitles.vtt", "text/vtt")}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-border/80 bg-background/80 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition"
          >
            <Download className="h-3.5 w-3.5 text-emerald-500" />
            Download .VTT
          </button>
        )}
        {daVinciScript && (
          <button
            type="button"
            onClick={handleCopyScript}
            className="inline-flex items-center gap-1.5 rounded-[6px] border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20 transition"
          >
            {copiedScript ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Film className="h-3.5 w-3.5 text-cyan-500" />
            )}
            {copiedScript ? "Script Copied!" : "Copy DaVinci Script"}
          </button>
        )}
      </div>
    </DataCardFrame>
  );
}
