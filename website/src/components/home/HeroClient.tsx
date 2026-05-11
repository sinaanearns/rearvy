"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LiveInterfacePanel from "./LiveInterfacePanel";

export default function HeroClient() {
  const reasoning = [
    "Connecting your business sources",
    "Explaining what changed",
    "Generating a clear next step",
    "Monitoring the result",
    "Routing updates to the right workspace",
  ];

  return (
    <section className="neural-grid relative isolate overflow-hidden border-b border-transparent">
      <div className="absolute inset-0 -z-20 bg-gradient-to-b from-[var(--rearvy-bg-1)] to-[var(--rearvy-bg-2)]" />
      <div className="particle-field" aria-hidden />

      <div className="mx-auto max-w-7xl px-6 py-12 lg:py-20">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div className="z-10 max-w-2xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-1.5 text-sm font-medium text-white/82 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Latest update: Trading Copilot, desktop updates, and cleaner insight cards
            </div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
              Connected AI business advisor
            </p>
            <h1 className="mb-6 text-[clamp(36px,6vw,72px)] leading-tight font-extrabold text-white">
              Your business, explained and acted on.
            </h1>
            <p className="max-w-xl text-lg text-white/70">
              Rearvy connects your business data, surfaces the important changes, and packages them into review-ready actions across web and desktop.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" className="h-12 bg-gradient-to-r from-[var(--rearvy-electric-violet)] to-[var(--rearvy-neon-blue)] text-white shadow-lg cinematic-glow">
                  Launch Rearvy
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="ghost" className="h-12 border border-white/8 text-white/90">
                  Watch Demo
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-col gap-2 text-sm text-white/65">
              {reasoning.map((r, i) => (
                <div key={r} className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/6 text-xs font-medium text-white/90">→</span>
                  <span className={i === reasoning.length - 1 ? "text-white" : "text-white/70"}>{r}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="z-10 flex items-center justify-end lg:justify-center">
            <LiveInterfacePanel />
          </div>
        </div>
      </div>
    </section>
  );
}
