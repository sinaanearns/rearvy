"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Sparkles, Terminal, X } from "lucide-react";
import { isElectron } from "@/lib/utils/env";

function ignoreExpectedStorageError(error: unknown) {
  void error;
}

export function UnlockBanner() {
  const [isWebsiteRuntime, setIsWebsiteRuntime] = useState<boolean | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return typeof window === "undefined" ? true : !window.sessionStorage.getItem("unlockBannerDismissed");
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const classifyRuntime = () => {
      setIsWebsiteRuntime(!isElectron());
    };

    const desktopBridgeDelay = window.setTimeout(classifyRuntime, 250);
    const desktopBridgeFallbackDelay = window.setTimeout(classifyRuntime, 1000);
    const onBridgeReady = () => setIsWebsiteRuntime(false);
    window.addEventListener("rearvy-electron-ready", onBridgeReady);
    classifyRuntime();
    return () => {
      window.clearTimeout(desktopBridgeDelay);
      window.clearTimeout(desktopBridgeFallbackDelay);
      window.removeEventListener("rearvy-electron-ready", onBridgeReady);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      try {
        window.sessionStorage.setItem("unlockBannerDismissed", "1");
      } catch (error) {
        ignoreExpectedStorageError(error);
      }
    }
  }, [visible]);

  if (isWebsiteRuntime !== true) return null;

  if (!visible) return null;

  return (
    <div className="border-b border-border/70 bg-background/95 px-3 py-2 text-sm shadow-sm shadow-slate-950/[0.02]">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 rounded-[8px] border border-amber-200/70 bg-amber-50/85 p-2.5 text-amber-950 shadow-sm shadow-amber-950/[0.03] dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-100 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="flex min-w-0 items-start gap-3 sm:items-center">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border border-amber-300/60 bg-white/70 text-amber-700 shadow-sm dark:border-amber-400/30 dark:bg-white/10 dark:text-amber-200">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold leading-5">
              Unlock full Rearvy features
            </p>
            <p className="mt-0.5 text-xs leading-5 text-amber-800/80 dark:text-amber-100/70">
              Terminal, AI automation, and device access are available in the desktop app.
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 pl-12 sm:pl-0">
          <Link
            href="/download"
            className="inline-flex h-9 items-center gap-2 rounded-[8px] border border-amber-300/70 bg-white px-3 text-xs font-semibold text-amber-950 shadow-sm transition-colors hover:bg-amber-100 dark:border-amber-400/30 dark:bg-white/10 dark:text-amber-50 dark:hover:bg-white/15"
          >
            <Download className="h-3.5 w-3.5" />
            Download app
          </Link>
          <span className="hidden h-9 items-center gap-1.5 rounded-[8px] border border-amber-300/50 bg-white/50 px-2.5 text-xs font-medium text-amber-800 dark:border-amber-400/20 dark:bg-white/5 dark:text-amber-100/75 md:inline-flex">
            <Terminal className="h-3.5 w-3.5" />
            Local tools
          </span>
          <button
            aria-label="Dismiss banner"
            onClick={() => setVisible(false)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-[8px] border border-transparent text-amber-800 transition-colors hover:border-amber-300/60 hover:bg-white/60 dark:text-amber-100 dark:hover:border-amber-400/20 dark:hover:bg-white/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
