"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import BusinessOutcomeBoard from "@/components/home/BusinessOutcomeBoard";

export default function HeroClient() {
  const benefits = [
    "Connect Shopify, GA, Stripe, Gmail, and 8+ integrations in <10 min",
    "AI explains changes and surfaces action-ready insights daily",
    "Execute moves without bouncing between tools",
    "Get alerts on anomalies: revenue drops, conversion shifts, support spikes",
    "Windows desktop app for always-on monitoring",
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
              For growth agencies, SaaS, and e-commerce teams
            </div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-widest text-white/60">
              Business intelligence at business speed
            </p>
            <h1 className="mb-6 text-[clamp(36px,6vw,72px)] leading-tight font-extrabold text-white">
              Move from data to decisions in one place.
            </h1>
            <p className="max-w-xl text-lg text-white/70">
              Rearvy syncs your business data, alerts you to what matters, and lets you execute without switching tools. See revenue, orders, metrics, and all your clients—unified and actionable.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/signup">
                <Button size="lg" className="h-12 bg-gradient-to-r from-[var(--rearvy-electric-violet)] to-[var(--rearvy-neon-blue)] text-white shadow-lg cinematic-glow">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="#use-cases">
                <Button size="lg" variant="ghost" className="h-12 border border-white/8 text-white/90">
                  See in Action
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-col gap-2 text-sm text-white/65">
              {benefits.map((benefit, i) => (
                <div key={benefit} className="flex items-center gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-white/6 text-xs font-medium text-white/90">✓</span>
                  <span className={i === benefits.length - 1 ? "text-white" : "text-white/70"}>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="z-10 flex items-center justify-center">
            <BusinessOutcomeBoard />
          </div>
        </div>
      </div>
    </section>
  );
}
