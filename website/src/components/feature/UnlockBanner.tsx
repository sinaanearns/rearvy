"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isElectron } from "@/lib/utils/env";
import { X } from "lucide-react";

export function UnlockBanner() {
  const [hasTerminalApi, setHasTerminalApi] = useState<boolean | null>(null);
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      return typeof window === "undefined" ? true : !window.sessionStorage.getItem("unlockBannerDismissed");
    } catch {
      return true;
    }
  });

  useEffect(() => {
    // Check for the preload bridge terminal API
    const check = async () => {
      const electron = typeof window !== "undefined" ? (window as any).electron : null;
      let available = !!electron?.terminal;
      if (available && electron?.getCapabilities) {
        try {
          const capabilities = await electron.getCapabilities();
          available = !!capabilities?.terminal;
        } catch {
          available = !!electron?.terminal;
        }
      }
      setHasTerminalApi(available);
    };

    const t = setTimeout(() => void check(), 500);
    const onBridgeReady = () => void check();
    window.addEventListener("rearvy-electron-ready", onBridgeReady);
    void check();
    return () => {
      clearTimeout(t);
      window.removeEventListener("rearvy-electron-ready", onBridgeReady);
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      try {
        window.sessionStorage.setItem("unlockBannerDismissed", "1");
      } catch {}
    }
  }, [visible]);

  // If we haven't determined availability yet, render nothing
  if (hasTerminalApi === null) return null;

  // If terminal API is available, don't show banner
  if (hasTerminalApi) return null;

  if (!visible) return null;

  return (
    <div className="bg-amber-50 border-b border-amber-200 text-amber-800 px-4 py-2 text-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <div>
          <strong>Unlock full Rearvy features:</strong> Terminal, AI automation, and device access are available in the desktop app.
        </div>
        <div className="flex items-center gap-2">
          <Link href="/download" className="text-amber-900 underline">
            Download desktop app
          </Link>
          <button
            aria-label="Dismiss banner"
            onClick={() => setVisible(false)}
            className="ml-2 inline-flex h-7 w-7 items-center justify-center rounded hover:bg-amber-100"
          >
            <X className="h-4 w-4 text-amber-800" />
          </button>
        </div>
      </div>
    </div>
  );
}
