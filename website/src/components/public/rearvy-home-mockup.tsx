"use client";

import { useState, type CSSProperties } from "react";
import {
  ArrowUp,
  Bot,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  Globe2,
  Mail,
  Monitor,
  MousePointer2,
  Search,
  Send,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Youtube,
} from "lucide-react";

type MockupMode = "brief" | "chat" | "browser" | "desktop";

const mockupModes = [
  { id: "browser", label: "Research", icon: Globe2 },
  { id: "chat", label: "Plan", icon: Bot },
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "brief", label: "Data", icon: FileText },
] satisfies Array<{
  id: MockupMode;
  label: string;
  icon: typeof FileText;
}>;

const clientSignals = [
  { label: "YouTube", value: "Video signals", icon: Youtube },
  { label: "Shopify", value: "Product context", icon: ShoppingBag },
  { label: "Browser", value: "Trend research", icon: Globe2 },
  { label: "Desktop", value: "Workflow ready", icon: Monitor },
];

const aiBriefItems = [
  "Reference videos show a faster first three seconds.",
  "Product research points to two stronger creative angles.",
  "Draft a ready-to-review video editing workflow.",
];

const browserResults = [
  {
    id: "r1",
    channel: "Creator Insights",
    title: "Why short-form hooks decide everything in 2025",
    views: "2.4M views",
    age: "3 weeks ago",
    tags: ["Hook", "Short-form"],
    highlight: true,
  },
  {
    id: "r2",
    channel: "Edit Lab",
    title: "Pacing patterns that retain viewers past 30 seconds",
    views: "890K views",
    age: "1 month ago",
    tags: ["Pacing", "Retention"],
    highlight: false,
  },
  {
    id: "r3",
    channel: "Trend Desk",
    title: "3 transition styles dominating the algorithm right now",
    views: "1.1M views",
    age: "2 weeks ago",
    tags: ["Transitions", "Algorithm"],
    highlight: false,
  },
];

const chatMessages = [
  {
    role: "user",
    text: "Plan a short-form video edit from the best examples.",
  },
  {
    role: "assistant",
    text: "I analysed 3 reference videos. The top hooks all open with movement in the first 1.5s. I\'ve built an edit outline around that pattern.",
  },
  {
    role: "user",
    text: "Great — also pull the best transition from the third video.",
  },
  {
    role: "assistant",
    text: "Done. The smash-cut at 0:08 is flagged. Edit outline updated. Desktop workflow is ready for your approval.",
  },
];

function BriefPanel() {
  return (
    <div className="rearvy-mockup-body">
      <aside className="rearvy-mockup-sidebar">
        <div>
          <p className="text-xs font-medium text-white/58">
            Workspace
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">Creator Studio</h3>
        </div>
        <div className="grid gap-2">
          {clientSignals.map((signal) => {
            const Icon = signal.icon;

            return (
              <div key={signal.label} className="rearvy-signal-row">
                <Icon className="h-4 w-4 text-[#69d7ff]" aria-hidden />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">
                    {signal.label}
                  </p>
                  <p className="truncate text-xs text-white/58">{signal.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <section className="rearvy-mockup-main">
        <div className="rearvy-command-card">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-[#69d7ff]">
                AI workflow
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Video edit plan
              </h3>
            </div>
            <div className="rearvy-live-pill">
              <span />
              Live
            </div>
          </div>

          <div className="mt-5 grid gap-3">
            {aiBriefItems.map((item, index) => (
              <div
                key={item}
                className="rearvy-brief-line"
                style={{ "--line-delay": `${index * 0.7}s` } as CSSProperties}
              >
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#69d7ff]" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: "Avg watch time", value: "34s", sub: "+12% vs baseline", color: "text-[#7de7c7]" },
              { label: "Top hook style", value: "Motion", sub: "First 1.5 seconds", color: "text-[#69d7ff]" },
              { label: "Best performer", value: "2.4M", sub: "Creator Insights", color: "text-[#f7c948]" },
            ].map((stat) => (
              <div key={stat.label} className="rounded-[6px] border border-white/8 bg-white/[0.04] p-2">
                <p className="text-[9px] font-medium text-white/40">{stat.label}</p>
                <p className={`mt-1 text-base font-bold leading-none ${stat.color}`}>{stat.value}</p>
                <p className="mt-1 text-[9px] text-white/36">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rearvy-task-grid">
          <div className="rearvy-task-card">
            <Clock3 className="h-4 w-4 text-[#f7c948]" aria-hidden />
            <span>Review references</span>
          </div>
          <div className="rearvy-task-card">
            <MousePointer2 className="h-4 w-4 text-[#ff9f7a]" aria-hidden />
            <span>Open video editor</span>
          </div>
          <div className="rearvy-task-card">
            <Mail className="h-4 w-4 text-[#69d7ff]" aria-hidden />
            <span>Prepare edit notes</span>
          </div>
        </div>
      </section>
    </div>
  );
}

function ChatPanel() {
  return (
    <div className="rearvy-chat-preview">
      <div className="rearvy-chat-thread">
        {chatMessages.map((message) => (
          <div
            key={message.text}
            className={
              message.role === "user"
                ? "rearvy-chat-bubble rearvy-chat-bubble-user"
                : "rearvy-chat-bubble rearvy-chat-bubble-ai"
            }
          >
            {message.text}
          </div>
        ))}
      </div>

      <div className="rearvy-chat-action-card">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-1 h-4 w-4 shrink-0 text-[#69d7ff]" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">
              Video workflow draft ready
            </p>
            <p className="mt-1 text-xs leading-5 text-white/54">
              Reference notes, smash-cut flagged, edit steps, and desktop handoff ready for approval.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {["Open in Desktop", "Export outline", "Regenerate"].map((action) => (
                <button
                  key={action}
                  type="button"
                  className="rounded-full border border-white/12 bg-white/[0.05] px-2.5 py-1 text-[10px] font-medium text-white/64 transition hover:border-white/24 hover:text-white/88"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rearvy-chat-composer">
        <div className="rearvy-workspace-chip">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Working in Creator Studio
        </div>
        <div className="rearvy-input-row">
          <span>Ask Rearvy to research, plan, or operate...</span>
          <button type="button" aria-label="Send preview prompt">
            <ArrowUp className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}

function BrowserPanel() {
  return (
    <div className="rearvy-browser-preview">
      <div className="rearvy-browser-toolbar">
        <Search className="h-4 w-4 text-[#69d7ff]" aria-hidden />
        <span>researching video trends and reference edits</span>
      </div>

      <div className="rearvy-browser-grid">
        <div className="rearvy-browser-page">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">
            Top results
          </p>
          <div className="grid gap-2">
            {browserResults.map((result) => (
              <div
                key={result.id}
                className={`rounded-[7px] border p-2.5 ${
                  result.highlight
                    ? "border-[#69d7ff]/30 bg-[#69d7ff]/10"
                    : "border-white/8 bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-semibold text-[#69d7ff]/80">
                    {result.channel}
                  </p>
                  <p className="text-[10px] text-white/36">{result.age}</p>
                </div>
                <p className="mt-1 text-xs font-medium leading-[1.35] text-white/88">
                  {result.title}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-white/44">{result.views}</span>
                  <span className="h-0.5 w-0.5 rounded-full bg-white/24" />
                  {result.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-white/12 bg-white/[0.04] px-1.5 py-0.5 text-[9px] font-medium text-white/56"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rearvy-browser-notes">
          <p>Rearvy found</p>
          <h3>3 edit patterns</h3>
          <span>Hooks, pacing &amp; transitions — ready to turn into a clear edit plan.</span>
          <div className="mt-3 grid gap-1.5">
            {["Hook structure", "Pacing rhythm", "Transition style"].map((insight) => (
              <div key={insight} className="flex items-center gap-2 text-[10px] text-white/60">
                <span className="h-1 w-1 rounded-full bg-[#69d7ff]/70" />
                {insight}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function DesktopPanel() {
  return (
    <div className="rearvy-desktop-preview">
      {/* Simulated desktop environment */}
      <div className="relative overflow-hidden rounded-[8px] border border-white/10 bg-[#0d0f10]">

        {/* Fake app title bar */}
        <div className="flex items-center gap-3 border-b border-white/8 bg-[#111416] px-3 py-2">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#ff6f61]/70" />
            <span className="h-2 w-2 rounded-full bg-[#f7c948]/70" />
            <span className="h-2 w-2 rounded-full bg-[#38d39f]/70" />
          </div>
          <span className="text-[10px] font-medium text-white/40">Video Editor — project_hero_v3.mp4</span>
          <div className="ml-auto flex items-center gap-2">
            <span className="rounded border border-[#69d7ff]/30 bg-[#69d7ff]/10 px-1.5 py-0.5 text-[9px] font-semibold text-[#69d7ff]">
              Rearvy active
            </span>
          </div>
        </div>

        {/* Preview + file panel */}
        <div className="grid grid-cols-[1fr_80px] divide-x divide-white/8">
          {/* Main preview area */}
          <div className="flex flex-col">
            {/* Video canvas */}
            <div className="relative flex h-[88px] items-center justify-center overflow-hidden bg-[#060808]">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(105,215,255,0.06),transparent_70%)]" />
              {/* Scene strip */}
              <div className="flex h-full w-full items-stretch gap-px px-0">
                {[
                  { label: "Hook", w: "w-[30%]", bg: "bg-[#69d7ff]/10", accent: "border-l-2 border-[#69d7ff]/60" },
                  { label: "Cut", w: "w-[8%]", bg: "bg-[#ff6f61]/10", accent: "border-l-2 border-[#ff6f61]/60" },
                  { label: "B-roll", w: "w-[22%]", bg: "bg-white/[0.04]", accent: "" },
                  { label: "Transition", w: "w-[12%]", bg: "bg-[#f7c948]/10", accent: "border-l-2 border-[#f7c948]/50" },
                  { label: "CTA", w: "w-[28%]", bg: "bg-[#7de7c7]/8", accent: "border-l-2 border-[#7de7c7]/40" },
                ].map((scene) => (
                  <div key={scene.label} className={`relative flex shrink-0 ${scene.w} flex-col items-start justify-end ${scene.bg} ${scene.accent} pb-1.5 pl-1`}>
                    <span className="text-[8px] font-semibold text-white/40">{scene.label}</span>
                  </div>
                ))}
              </div>
              {/* Playhead */}
              <div className="absolute bottom-0 left-[38%] h-full w-px bg-[#69d7ff]/70 shadow-[0_0_6px_rgba(105,215,255,0.6)]" />
              {/* Timecode */}
              <div className="absolute right-2 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[8px] font-mono text-white/50">
                00:00:14
              </div>
            </div>

            {/* Timeline */}
            <div className="border-t border-white/8 bg-[#0e1012] p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-[9px] font-medium text-white/36">TIMELINE</span>
                <span className="text-[9px] text-white/28">00:00:14 / 00:01:02</span>
              </div>
              {/* Track rows */}
              {[
                { label: "V1", color: "bg-[#69d7ff]/40", segments: ["w-[30%]", "w-[8%]", "w-[22%]", "w-[12%]", "w-[20%]"] },
                { label: "A1", color: "bg-[#7de7c7]/35", segments: ["w-[72%]", "w-[20%]"] },
                { label: "FX", color: "bg-[#f7c948]/30", segments: ["w-[8%]", "w-[12%]", "w-[6%]"] },
              ].map((track) => (
                <div key={track.label} className="mb-1 flex items-center gap-1.5">
                  <span className="w-4 shrink-0 text-[8px] font-bold text-white/30">{track.label}</span>
                  <div className="relative flex h-4 flex-1 items-center gap-0.5 overflow-hidden rounded-[3px] bg-white/[0.04]">
                    {track.segments.map((w, i) => (
                      <div key={i} className={`h-full ${w} shrink-0 rounded-[2px] ${track.color}`} />
                    ))}
                    {/* Playhead on timeline */}
                    <div className="absolute left-[38%] top-0 h-full w-px bg-[#69d7ff]/70 shadow-[0_0_4px_rgba(105,215,255,0.5)]" />
                  </div>
                </div>
              ))}
              {/* Waveform row */}
              <div className="mt-0.5 flex items-center gap-1.5">
                <span className="w-4 shrink-0 text-[8px] font-bold text-white/20">W</span>
                <div className="relative flex h-3 flex-1 items-end justify-start gap-px overflow-hidden rounded-[3px] bg-white/[0.03] px-0.5">
                  {Array.from({ length: 36 }).map((_, i) => {
                    const heights = [2, 4, 7, 5, 9, 6, 3, 8, 10, 5, 4, 7, 9, 3, 6, 8, 5, 4, 10, 7, 3, 6, 8, 9, 4, 5, 7, 3, 6, 8, 5, 9, 4, 6, 7, 3];
                    const h = heights[i % heights.length];
                    return <div key={i} style={{ height: `${h}px` }} className="w-px shrink-0 rounded-full bg-[#7de7c7]/30" />;
                  })}
                  <div className="absolute left-[38%] top-0 h-full w-px bg-[#69d7ff]/60" />
                </div>
              </div>
            </div>
          </div>

          {/* File reference panel */}
          <div className="flex flex-col gap-1 p-2">
            <p className="text-[8px] font-semibold uppercase tracking-[0.12em] text-white/30">Refs</p>
            {[
              { name: "hook_ref_1.mp4", color: "bg-[#69d7ff]/20" },
              { name: "hook_ref_2.mp4", color: "bg-[#69d7ff]/12" },
              { name: "pacing_ex.mp4", color: "bg-[#7de7c7]/15" },
              { name: "transition.mp4", color: "bg-[#f7c948]/15" },
            ].map((file) => (
              <div key={file.name} className={`rounded-[4px] ${file.color} p-1.5`}>
                <p className="truncate text-[8px] leading-tight text-white/60">{file.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Approval card */}
      <div className="rearvy-desktop-approval mt-3">
        <ShieldCheck className="h-5 w-5 text-[#69d7ff]" aria-hidden />
        <div>
          <p>Approval required</p>
          <span>Open the editor, collect references, prepare the timeline.</span>
        </div>
      </div>

      <div className="rearvy-desktop-steps">
        {[
          { step: "Open video editor", done: true },
          { step: "Capture reference cues", done: true },
          { step: "Prepare edit plan", done: false },
        ].map(({ step, done }, index) => (
          <div key={step} className="rearvy-desktop-step">
            <span
              className={done ? "border-[#69d7ff]/40 bg-[#69d7ff]/15 text-[#69d7ff]" : ""}
            >
              {done ? <CheckCircle2 className="h-3 w-3" /> : index + 1}
            </span>
            <p className={done ? "text-white/50 line-through" : ""}>{step}</p>
          </div>
        ))}
      </div>

      <button type="button" className="rearvy-blue-action">
        <Send className="h-4 w-4" aria-hidden />
        Approve workflow
      </button>
    </div>
  );
}

function ActivePanel({ mode }: { mode: MockupMode }) {
  if (mode === "chat") {
    return <ChatPanel />;
  }

  if (mode === "browser") {
    return <BrowserPanel />;
  }

  if (mode === "desktop") {
    return <DesktopPanel />;
  }

  return <BriefPanel />;
}

export function RearvyHomeMockup() {
  const [mode, setMode] = useState<MockupMode>("browser");
  const activeMode = mockupModes.find((item) => item.id === mode) ?? mockupModes[0];
  const ActiveIcon = activeMode.icon;

  return (
    <div
      className="rearvy-mockup"
      data-mode={mode}
      aria-label="Interactive Rearvy workspace mockup"
    >
      <div className="rearvy-mockup-window">
        <div className="rearvy-mockup-topbar">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[#ff6f61]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#f7c948]" />
            <span className="h-2.5 w-2.5 rounded-full bg-[#38d39f]" />
          </div>
          <span>Rearvy Workspace</span>
        </div>

        <div className="rearvy-mode-bar" role="tablist" aria-label="Mockup modes">
          {mockupModes.map((item) => {
            const Icon = item.icon;
            const isActive = item.id === mode;

            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-label={item.label}
                aria-selected={isActive}
                className="rearvy-mode-button"
                onClick={() => setMode(item.id)}
              >
                <Icon className="h-4 w-4" aria-hidden />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        <div className="rearvy-active-strip">
          <ActiveIcon className="h-4 w-4 text-[#69d7ff]" aria-hidden />
          <span>{activeMode.label} mode</span>
        </div>

        <ActivePanel mode={mode} />
      </div>
    </div>
  );
}
