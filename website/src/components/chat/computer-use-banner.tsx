"use client";

import { useEffect, useRef, useState } from "react";
import { Monitor, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ComputerUseBannerProps = {
  /** Show the desktop OS control state */
  isDesktopActive: boolean;
  /** Show the browser drive loop state */
  isBrowserActive: boolean;
  /** Label for the current step / action in progress */
  stepLabel?: string | null;
  /** Called when the user clicks the Esc / stop button */
  onStop?: () => void;
  className?: string;
};

/**
 * Sticky top-of-viewport banner shown while Rearvy is autonomously controlling
 * the desktop or a browser session.  Mirrors the UX pattern used by ChatGPT's
 * "ChatGPT is using your computer" indicator.
 */
export function ComputerUseBanner({
  isDesktopActive,
  isBrowserActive,
  stepLabel,
  onStop,
  className,
}: ComputerUseBannerProps) {
  const isActive = isDesktopActive || isBrowserActive;
  const [dots, setDots] = useState(".");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Animate trailing dots while active
  useEffect(() => {
    if (!isActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setDots(".");
      return;
    }

    intervalRef.current = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? "." : prev + "."));
    }, 500);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive]);

  if (!isActive) return null;

  const icon = isDesktopActive ? (
    <Monitor className="h-4 w-4 shrink-0 text-white" />
  ) : (
    <Globe className="h-4 w-4 shrink-0 text-white" />
  );

  const label = isDesktopActive
    ? "Rearvy is using your computer"
    : "Rearvy is controlling the browser";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        // Positioned at the very top of the viewport, centred horizontally
        "pointer-events-none fixed inset-x-0 top-4 z-[9999] flex justify-center px-4",
        className
      )}
    >
      <div
        className={cn(
          // Pill shape inspired by ChatGPT's banner
          "pointer-events-auto flex items-center gap-3 rounded-full",
          "border border-white/15 shadow-2xl",
          "px-4 py-2.5",
          // Background: vivid gradient that stands out on any page colour
          isDesktopActive
            ? "bg-gradient-to-r from-violet-600 to-purple-700"
            : "bg-gradient-to-r from-emerald-600 to-teal-700",
          // Subtle glow beneath the pill
          isDesktopActive
            ? "shadow-violet-900/60"
            : "shadow-emerald-900/60"
        )}
      >
        {/* Pulsing status dot */}
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              isDesktopActive ? "bg-violet-200" : "bg-emerald-200"
            )}
          />
          <span
            className={cn(
              "relative inline-flex h-2.5 w-2.5 rounded-full",
              "bg-white"
            )}
          />
        </span>

        {/* Icon */}
        {icon}

        {/* Main label */}
        <span className="max-w-[20rem] truncate text-sm font-semibold text-white">
          {stepLabel ? stepLabel : label}
          <span className="ml-0.5 inline-block w-5 text-left text-white/70">
            {dots}
          </span>
        </span>

        {/* Separator */}
        {onStop && (
          <span className="h-4 w-px shrink-0 bg-white/25" aria-hidden />
        )}

        {/* Esc / stop button */}
        {onStop && (
          <button
            type="button"
            id="computer-use-banner-stop"
            aria-label="Stop Rearvy computer use"
            onClick={onStop}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1",
              "text-xs font-semibold text-white/90",
              "transition-all duration-150",
              "hover:bg-white/20 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            )}
          >
            <X className="h-3 w-3" />
            <span>Esc to cancel</span>
          </button>
        )}
      </div>
    </div>
  );
}
