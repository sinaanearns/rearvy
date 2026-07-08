"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, MonitorDown } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

type InstallState = "checking" | "ready" | "prompting" | "installed" | "unavailable";

function isStandaloneDisplay() {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
}

function canRegisterServiceWorker() {
  return (
    "serviceWorker" in navigator &&
    (window.location.protocol === "https:" ||
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1")
  );
}

export function RearvyWebInstallCard() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installState, setInstallState] = useState<InstallState>("checking");
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (isStandaloneDisplay()) {
      setInstallState("installed");
      return;
    }

    if (canRegisterServiceWorker()) {
      navigator.serviceWorker.register("/rearvy-sw.js").catch(() => {
        setInstallState((currentState) =>
          currentState === "checking" ? "unavailable" : currentState
        );
      });
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
      setInstallState("ready");
      setShowFallback(false);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setInstallState("installed");
      setShowFallback(false);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    const fallbackTimer = window.setTimeout(() => {
      setInstallState((currentState) =>
        currentState === "checking" ? "unavailable" : currentState
      );
    }, 1800);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
      window.clearTimeout(fallbackTimer);
    };
  }, []);

  const installWebApp = useCallback(async () => {
    if (!installPrompt) {
      setShowFallback(true);
      return;
    }

    setInstallState("prompting");
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    setInstallState(choice.outcome === "accepted" ? "installed" : "unavailable");
    setShowFallback(choice.outcome !== "accepted");
  }, [installPrompt]);

  const statusCopy =
    installState === "ready"
      ? "Install Rearvy from this website into Chrome or Edge."
      : installState === "prompting"
        ? "Waiting for the browser install prompt."
        : installState === "installed"
          ? "Rearvy is installed as a browser app."
          : "Use the browser install icon or menu if the prompt is not available.";

  const buttonCopy =
    installState === "ready"
      ? "Install web app"
      : installState === "prompting"
        ? "Opening prompt"
        : installState === "installed"
          ? "Installed"
          : "Install from browser";

  return (
    <div className="rounded-[8px] border border-[#69d7ff]/22 bg-[#69d7ff]/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] border border-[#69d7ff]/28 bg-[#69d7ff]/14 text-[#69d7ff]">
            {installState === "installed" ? (
              <CheckCircle2 className="h-4 w-4" aria-hidden />
            ) : (
              <MonitorDown className="h-4 w-4" aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Install Rearvy web app</p>
            <p className="mt-1 text-xs leading-5 text-white/64">{statusCopy}</p>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => void installWebApp()}
        disabled={installState === "prompting" || installState === "installed"}
        className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-[8px] bg-white px-4 text-sm font-semibold text-black transition hover:bg-cyan-50 disabled:cursor-default disabled:opacity-70"
      >
        {buttonCopy}
        {installState === "installed" ? (
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        ) : (
          <ArrowRight className="h-4 w-4" aria-hidden />
        )}
      </button>

      {showFallback && installState !== "installed" ? (
        <p className="mt-3 rounded-[8px] border border-white/10 bg-black/24 px-3 py-2 text-xs leading-5 text-white/62">
          Browser install prompts appear only on supported browsers and secure origins.
        </p>
      ) : null}
    </div>
  );
}
