"use client";

import Link from "next/link";
import { Building2, Home, ChevronRight } from "lucide-react";

export default function BusinessDashboardPage() {
  return (
    <main className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="flex items-center justify-between p-6 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Building2 className="h-5 w-5 text-cyan-200" />
          <span className="text-lg font-semibold">Business Dashboard</span>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 text-sm font-medium text-white/80 transition hover:border-white/40 hover:bg-white/10"
        >
          <Home className="h-4 w-4" />
          Public home
          <ChevronRight className="h-4 w-4" />
        </Link>
      </header>

      {/* Main Content */}
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold leading-tight tracking-tight">
          Welcome to your business workspace.
        </h1>
        <p className="mt-4 text-lg text-white/70">
          This space is dedicated to businesses registered with Rearvy. Manage onboarding, integrations, and billing from here.
        </p>

        {/* Cards */}
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {/* Getting Started Card */}
          <div className="rounded-lg border border-white/10 bg-slate-800/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-400/20 bg-emerald-400/10 text-emerald-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Getting started</h2>
            </div>
            <p className="text-sm leading-6 text-white/68">
              Complete your profile and connect apps. We&apos;ll prioritize your onboarding
            </p>
          </div>

          {/* Next Steps Card */}
          <div className="rounded-lg border border-white/10 bg-slate-800/50 p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-blue-400/20 bg-blue-400/10 text-blue-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-lg font-semibold text-white">Next steps</h2>
            </div>
            <p className="text-sm leading-6 text-white/68">
              You&apos;ll see dashboards and tools appear here as we enable your setup.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-20 p-6 text-center text-sm text-white/50">
        <p>(c) 2026 Rearvy. All rights reserved.</p>
      </footer>
    </main>
  );
}
