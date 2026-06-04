"use client";

import { useEffect, useState } from "react";
import { isElectron } from "@/lib/utils/env";
import { Button } from "@/components/ui/button";
import {
  AlertCircle,
  Download,
  RefreshCcw,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createClientLogger } from "@/lib/client-diagnostics";

const log = createClientLogger("UpdateChecker");

interface UpdateState {
  supported: boolean;
  checking: boolean;
  updateAvailable: boolean;
  downloading: boolean;
  downloaded: boolean;
  currentVersion: string | null;
  latestVersion: string | null;
  downloadPercent: number | null;
  lastError: string | null;
}

export function UpdateChecker() {
  const [updateState, setUpdateState] = useState<UpdateState | null>(null);

  useEffect(() => {
    if (!isElectron() || !window.electron?.updater) {
      return;
    }

    let mounted = true;

    const initState = async () => {
      try {
        if (!window.electron?.updater) return;
        const state = await window.electron.updater.getState();
        if (mounted) {
          setUpdateState(state);
        }
      } catch (error) {
        log.error("Failed to get update state:", error);
      }
    };

    void initState();

    if (!window.electron?.updater) return;
    const removeListener = window.electron.updater.onStateChange((state) => {
      if (mounted) {
        setUpdateState(state);
      }
    });

    return () => {
      mounted = false;
      removeListener?.();
    };
  }, []);

  if (!updateState?.supported) {
    return null;
  }

  const handleCheckForUpdates = async () => {
    if (!window.electron?.updater) {
      return;
    }

    try {
      const result = await window.electron.updater.checkForUpdates();
      if (!result.ok) {
        toast.error(`Update check failed: ${result.reason || "Unknown error"}`);
      }
    } catch (error) {
      log.error("Failed to check for updates:", error);
      toast.error("Failed to check for updates");
    }
  };

  const handleDownloadUpdate = async () => {
    if (!window.electron?.updater) {
      return;
    }

    try {
      const result = await window.electron.updater.downloadUpdate();
      if (!result.ok) {
        toast.error(`Update download failed: ${result.reason || "Unknown error"}`);
      } else {
        toast.info("Update downloading...");
      }
    } catch (error) {
      log.error("Failed to download update:", error);
      toast.error("Failed to download update");
    }
  };

  const handleInstallUpdate = async () => {
    if (!window.electron?.updater) {
      return;
    }

    try {
      const result = await window.electron.updater.installAndRestart();
      if (!result.ok) {
        toast.error(`Update installation failed: ${result.reason || "Unknown error"}`);
      }
    } catch (error) {
      log.error("Failed to install update:", error);
      toast.error("Failed to install update");
    }
  };

  // If update is already downloaded, show prominent install button
  if (updateState.downloaded) {
    return (
      <Button
        onClick={handleInstallUpdate}
        className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2 animate-pulse"
        size="sm"
      >
        <CheckCircle2 className="h-4 w-4" />
        <span className="hidden sm:inline">Install Update</span>
        <span className="sm:hidden">Update Ready</span>
      </Button>
    );
  }

  // If update is available and not downloading, show download button
  if (updateState.updateAvailable && !updateState.downloading) {
    return (
      <Button
        onClick={handleDownloadUpdate}
        className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
        size="sm"
      >
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Download Update</span>
        <span className="sm:hidden">Update</span>
      </Button>
    );
  }

  // If currently downloading, show progress
  if (updateState.downloading) {
    const percent = updateState.downloadPercent ?? 0;
    return (
      <div className="flex items-center gap-2">
        <Button disabled className="gap-2" size="sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="hidden sm:inline">Downloading</span>
          <span className="sm:hidden">{Math.round(percent)}%</span>
        </Button>
        <div className="hidden sm:block text-xs text-muted-foreground">
          {Math.round(percent)}%
        </div>
      </div>
    );
  }

  // If checking, show spinner
  if (updateState.checking) {
    return (
      <Button disabled className="gap-2" size="sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">Checking</span>
      </Button>
    );
  }

  // If there's an error, show warning
  if (updateState.lastError) {
    return (
      <Button
        onClick={handleCheckForUpdates}
        variant="outline"
        size="sm"
        className="gap-2 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-950/30"
      >
        <AlertCircle className="h-4 w-4" />
        <span className="hidden sm:inline">Retry</span>
      </Button>
    );
  }

  // Default: No update available, show check button
  return (
    <Button
      onClick={handleCheckForUpdates}
      variant="ghost"
      size="sm"
      className="gap-2"
      title="Check for Rearvy updates"
    >
      <RefreshCcw className="h-4 w-4" />
      <span className="hidden sm:inline">Check Updates</span>
    </Button>
  );
}
