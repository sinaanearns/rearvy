"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import BusinessOutcomeBoard from "@/components/home/BusinessOutcomeBoard";

export default function HeroClient() {
  const signals = [
    "8+ business integrations live in minutes",
    "24/7 monitoring with action-ready briefs",
    "Review, approve, and execute without tool hopping",
  ];

  const supportingPoints = [
    "Connected commerce, marketing, and support context",
    "Designed for agencies, SaaS, and e-commerce teams",
    "Built for the web now, desktop always-on when needed",
  ];

  return (
    <section className="neural-grid relative isolate overflow-hidden border-b border-transparent">
      <div className="absolute inset-0 -z-20 bg-[radial-gradient(circle_at_top_left,rgba(138,43,226,0.24),transparent_28%),radial-gradient(circle_at_top_right,rgba(51,209,255,0.16),transparent_22%),linear-gradient(180deg,var(--rearvy-bg-1),var(--rearvy-bg-2))]" />
      <div className="particle-field" aria-hidden />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-32 bg-gradient-to-b from-white/5 to-transparent" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="z-10 max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-4 py-1.5 text-sm font-medium text-white/82 backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              Autonomous business intelligence for modern teams
            </div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.32em] text-white/55">
              Rearvy turns signals into action
            </p>
            <h1 className="max-w-4xl text-[clamp(42px,6.5vw,84px)] leading-[0.94] font-black tracking-[-0.04em] text-white">
              Your business, but with a decision layer.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-8 text-white/72 sm:text-xl">
              Rearvy unifies live commerce, marketing, and support data, then converts the noise into a short, actionable brief your team can approve in minutes.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" className="h-12 bg-gradient-to-r from-[var(--rearvy-electric-violet)] to-[var(--rearvy-neon-blue)] px-6 text-white shadow-lg cinematic-glow transition-transform hover:-translate-y-0.5">
                  Start free
                </Button>
              </Link>
              <Link href="#proof">
                <Button size="lg" variant="ghost" className="h-12 border border-white/10 px-6 text-white/90 backdrop-blur hover:bg-white/8">
                  See proof
                </Button>
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {signals.map((signal) => (
                <div key={signal} className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white/75 backdrop-blur">
                  {signal}
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap gap-2 text-sm text-white/60">
              {supportingPoints.map((point) => (
                <span key={point} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 backdrop-blur">
                  {point}
                </span>
              ))}
            </div>
          </div>

          <div className="z-10 flex items-center justify-center lg:justify-end">
            <BusinessOutcomeBoard />
          </div>
        </div>
      </div>
    </section>
  );
}
