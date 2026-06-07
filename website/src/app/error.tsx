"use client";

import Link from "next/link";
import { AlertTriangle, ArrowRight, Home, RotateCcw } from "lucide-react";
import { createClientLogger } from "@/lib/client-diagnostics";

const log = createClientLogger("PageErrorBoundary");

/**
 * App Router error boundary for pages.
 * Catches and handles errors from page.tsx and nested layouts.
 */
export default function ErrorBoundary({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  log.error("Page error:", {
    message: error.message,
    digest: error.digest,
    stack: error.stack,
  });

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] px-4 py-10 text-white">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(244,63,94,0.24),transparent_34%),linear-gradient(315deg,rgba(20,184,166,0.18),transparent_28%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:64px_64px]" />

      <section className="relative w-full max-w-3xl overflow-hidden rounded-[8px] border border-white/12 bg-white/8 shadow-sm shadow-black/25 backdrop-blur-xl">
        <div className="grid gap-0 md:grid-cols-[0.78fr_1.22fr]">
          <div className="flex flex-col justify-between border-b border-white/10 bg-black/28 p-6 md:border-b-0 md:border-r">
            <div>
              <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-rose-200/20 bg-rose-300/12 text-rose-100">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="mt-6 text-sm font-medium text-rose-100/78">
                Page error
              </p>
              <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight">
                Something interrupted this workspace.
              </h1>
            </div>
            {error.digest && (
              <p className="mt-8 rounded-[6px] border border-white/10 bg-black/24 px-3 py-2 font-mono text-xs text-white/58">
                Digest: {error.digest}
              </p>
            )}
          </div>

          <div className="p-6 sm:p-8">
            <p className="text-base leading-7 text-white/68">
              Rearvy hit an unexpected page error. You can retry the current route, return home, or open the workspace again from a clean route.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
              <Link
                href="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-white/20 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                <Home className="h-4 w-4" />
                Home
              </Link>
              <Link
                href="/chat"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-white/20 px-5 text-sm font-semibold text-white/76 transition hover:border-white hover:text-white"
              >
                Workspace
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
