"use client";

import { AlertTriangle, Home, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  console.error("Global error:", error);

  return (
    <html lang="en">
      <body>
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] px-4 py-10 font-sans text-white">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(244,63,94,0.24),transparent_34%),linear-gradient(315deg,rgba(20,184,166,0.18),transparent_28%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.055)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.055)_1px,transparent_1px)] bg-[size:64px_64px]" />

          <section className="relative w-full max-w-2xl overflow-hidden rounded-[8px] border border-white/12 bg-white/8 p-6 shadow-sm shadow-black/25 backdrop-blur-xl sm:p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-[8px] border border-rose-200/20 bg-rose-300/12 text-rose-100">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="mt-6 text-sm font-medium text-rose-100/78">
              Global error
            </p>
            <h1 className="mt-3 max-w-xl text-4xl font-semibold leading-tight tracking-tight">
              Rearvy needs a clean restart for this view.
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-white/68">
              A root-level error interrupted the app shell. Retry the render, or return home and reopen the workspace from a fresh route.
            </p>

            {error.digest && (
              <p className="mt-6 rounded-[6px] border border-white/10 bg-black/24 px-3 py-2 font-mono text-xs text-white/50">
                Digest: {error.digest}
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] bg-white px-5 text-sm font-semibold text-black transition hover:bg-white/85"
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </button>
              <a
                href="/"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-white/20 px-5 text-sm font-semibold text-white transition hover:border-white/40 hover:bg-white/10"
              >
                <Home className="h-4 w-4" />
                Home
              </a>
            </div>
          </section>
        </main>
      </body>
    </html>
  );
}
