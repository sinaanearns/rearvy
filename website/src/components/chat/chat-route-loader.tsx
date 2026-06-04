"use client";

import {
  Database,
  FolderKanban,
  Loader2,
  MessageSquareText,
  Sparkles,
} from "lucide-react";

type ChatRouteLoaderProps = {
  title?: string;
  detail?: string;
  contextLabel?: string;
  variant?: "chat" | "project";
};

export function ChatRouteLoader({
  title = "Opening conversation",
  detail = "Loading messages, tools, and recent workspace context.",
  contextLabel = "Rearvy chat",
  variant = "chat",
}: ChatRouteLoaderProps) {
  const ContextIcon = variant === "project" ? FolderKanban : MessageSquareText;
  const loadingTiles = [
    { label: "Messages", detail: "Conversation history", icon: MessageSquareText },
    {
      label: variant === "project" ? "Project" : "Workspace",
      detail: variant === "project" ? "Client context" : "Saved context",
      icon: ContextIcon,
    },
    { label: "Sources", detail: "Connected data", icon: Database },
  ];

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-1 items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(20,184,166,0.2),transparent_34%),linear-gradient(315deg,rgba(99,102,241,0.18),transparent_34%)]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:58px_58px]" />

      <div className="relative w-full max-w-2xl overflow-hidden rounded-[8px] border border-white/10 bg-white/[0.07] p-5 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-6">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-200/70 to-transparent" />
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-cyan-200/20 bg-cyan-200/10 text-cyan-100">
              <Sparkles className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-cyan-100/72">
                {contextLabel}
              </p>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                {title}
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-white/60">
                {detail}
              </p>
            </div>
          </div>

          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[8px] border border-white/12 bg-black/24">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-100" aria-hidden="true" />
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {loadingTiles.map((tile) => {
            const TileIcon = tile.icon;

            return (
              <div
                key={tile.label}
                className="grid min-h-[72px] grid-cols-[36px_minmax(0,1fr)] items-center gap-3 rounded-[8px] border border-white/10 bg-black/20 p-3"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-[8px] border border-white/12 bg-white/8 text-cyan-100">
                  <TileIcon className="h-4 w-4" aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-white">{tile.label}</span>
                  <span className="mt-1 block truncate text-xs text-white/50">{tile.detail}</span>
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
