"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isElectron } from "@/lib/utils/env";

export function UnlockBanner() {
  const [hasTerminalApi, setHasTerminalApi] = useState<boolean | null>(null);

  useEffect(() => {
    // Check for the preload bridge terminal API
    const check = async () => {
      // If running in Electron, window.electron may be present; otherwise null
      // We consider terminal available if window.electron?.terminal exists
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

    // Delay check to allow preload to initialize
    const t = setTimeout(() => void check(), 500);
    const onBridgeReady = () => void check();
    window.addEventListener("rearvy-electron-ready", onBridgeReady);
    // Also run immediately
    void check();
    return () => {
      clearTimeout(t);
      window.removeEventListener("rearvy-electron-ready", onBridgeReady);
    };
  }, []);

  // If we haven't determined availability yet, render nothing
  if (hasTerminalApi === null) return null;

  // If terminal API is available, don't show banner
  if (hasTerminalApi) return null;

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
        </div>
      </div>
    </div>
  );
}
