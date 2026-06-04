"use client";

import { useState, type CSSProperties } from "react";
import {
  ArrowUp,
  BarChart3,
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
} from "lucide-react";

type MockupMode = "brief" | "chat" | "browser" | "desktop";

const mockupModes = [
  { id: "browser", label: "Browser", icon: Globe2 },
  { id: "chat", label: "Chat", icon: Bot },
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "brief", label: "Brief", icon: FileText },
] satisfies Array<{
  id: MockupMode;
  label: string;
  icon: typeof FileText;
}>;

const clientSignals = [
  { label: "Shopify", value: "Revenue lift", icon: ShoppingBag },
  { label: "Analytics", value: "Traffic shifts", icon: BarChart3 },
  { label: "Gmail", value: "Inbox context", icon: Mail },
  { label: "Web", value: "Live research", icon: Globe2 },
];

const aiBriefItems = [
  "Returning customers slowed while new revenue climbed.",
  "Creative refresh pushed paid social traffic up.",
  "Draft a business-ready review with retention actions.",
];

const chatMessages = [
  {
    role: "user",
    text: "Get me ready for the Nova Coffee business review.",
  },
  {
    role: "assistant",
    text: "Revenue is up, repeat purchase is slipping, and Gmail has two open customer questions. I can turn this into a brief.",
  },
];

function BriefPanel() {
  return (
    <div className="rearvy-mockup-body">
      <aside className="rearvy-mockup-sidebar">
        <div>
          <p className="text-xs font-medium text-white/48">
            Business
          </p>
          <h3 className="mt-2 text-lg font-semibold text-white">Nova Coffee</h3>
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
                  <p className="truncate text-xs text-white/48">{signal.value}</p>
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
                AI brief
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">
                Monday account review
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
        </div>

        <div className="rearvy-task-grid">
          <div className="rearvy-task-card">
            <Clock3 className="h-4 w-4 text-[#f7c948]" aria-hidden />
            <span>Prepare review deck</span>
          </div>
          <div className="rearvy-task-card">
            <MousePointer2 className="h-4 w-4 text-[#ff9f7a]" aria-hidden />
            <span>Open campaign report</span>
          </div>
          <div className="rearvy-task-card">
            <Mail className="h-4 w-4 text-[#69d7ff]" aria-hidden />
            <span>Draft follow-up email</span>
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
          <div>
            <p className="text-sm font-semibold text-white">
              Business review draft ready
            </p>
            <p className="mt-1 text-xs leading-5 text-white/54">
              Brief, action list, and follow-up email are waiting for approval.
            </p>
          </div>
        </div>
      </div>

      <div className="rearvy-chat-composer">
        <div className="rearvy-workspace-chip">
          <FolderOpen className="h-3.5 w-3.5" aria-hidden />
          Working in Nova Coffee
        </div>
        <div className="rearvy-input-row">
          <span>Ask Rearvy to prepare the business review...</span>
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
        <span>researching competitor landing pages</span>
      </div>

      <div className="rearvy-browser-grid">
        <div className="rearvy-browser-page">
          <div className="h-4 w-28 rounded-full bg-white/16" />
          <div className="mt-5 grid gap-2">
            <div className="h-16 rounded-[8px] bg-[#69d7ff]/14" />
            <div className="h-8 rounded-[8px] bg-white/10" />
            <div className="h-8 rounded-[8px] bg-white/8" />
          </div>
        </div>
        <div className="rearvy-browser-notes">
          <p>Rearvy found</p>
          <h3>3 positioning gaps</h3>
          <span>Turn into business-ready recommendations.</span>
        </div>
      </div>
    </div>
  );
}

function DesktopPanel() {
  return (
    <div className="rearvy-desktop-preview">
      <div className="rearvy-desktop-approval">
        <ShieldCheck className="h-5 w-5 text-[#69d7ff]" aria-hidden />
        <div>
          <p>Approval required</p>
          <span>Open report, collect screenshots, draft summary.</span>
        </div>
      </div>

      <div className="rearvy-desktop-steps">
        {["Open analytics", "Capture key chart", "Prepare business note"].map(
          (step, index) => (
            <div key={step} className="rearvy-desktop-step">
              <span>{index + 1}</span>
              <p>{step}</p>
            </div>
          )
        )}
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
