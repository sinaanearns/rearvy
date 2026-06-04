"use client";

import dynamic from "next/dynamic";
import { Loader2, MessageSquareText, Sparkles } from "lucide-react";

function DemoChatLoading() {
  return (
    <div
      className="relative h-[calc(100vh-7rem)] overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.07] text-white shadow-sm shadow-black/20 backdrop-blur-xl"
      role="status"
      aria-live="polite"
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.14),transparent_34%),linear-gradient(315deg,rgba(245,158,11,0.1),transparent_42%)]" />
      <div className="relative flex h-full items-center justify-center px-5">
        <div className="w-full max-w-[420px] rounded-[8px] border border-white/10 bg-[#0d1117]/78 p-4 shadow-sm shadow-black/20">
          <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
                <MessageSquareText className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Preparing demo workspace</p>
                <p className="mt-1 text-xs leading-5 text-white/52">
                  Loading connected brand context.
                </p>
              </div>
            </div>
            <Loader2 className="mt-1 h-5 w-5 shrink-0 animate-spin text-cyan-100" aria-hidden="true" />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["Brief", "Signals", "Reply"].map((label, index) => (
              <div
                key={label}
                className="flex min-w-0 items-center gap-2 rounded-[8px] border border-white/10 bg-white/[0.05] px-3 py-2 text-xs font-medium text-white/64"
              >
                <Sparkles
                  className={index === 0 ? "h-3.5 w-3.5 text-amber-200" : "h-3.5 w-3.5 text-cyan-100/70"}
                  aria-hidden="true"
                />
                <span className="truncate">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const DemoChatClient = dynamic(() => import("./demo-chat-client"), {
  ssr: false,
  loading: DemoChatLoading,
});

export function DemoChatNoSsr() {
  return <DemoChatClient />;
}
