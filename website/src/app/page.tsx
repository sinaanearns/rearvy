"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isElectron } from "@/lib/utils/env";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import HeroClient from "@/components/home/HeroClient";
import { REARVY_PLANS } from "@/lib/plans";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  CirclePlay,
  Database,
  Download,
  FileText,
  LineChart,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
} from "lucide-react";

const NAV_LINKS = [
  { href: "#workflows", label: "Workflows" },
  { href: "#features", label: "Features" },
  { href: "#pricing", label: "Pricing" },
];

const SUPPORTED_INTEGRATIONS = [
  "Shopify",
  "Google Analytics",
  "Instagram",
  "Facebook",
  "YouTube",
  "Gmail",
  "Excel",
  "Razorpay",
];

const HERO_POINTS = [
  "Autonomous decision making",
  "24/7 proactive monitoring",
  "Zero-dashboard management",
];

const HERO_METRICS = [
  {
    label: "Revenue",
    value: "+12.4%",
    detail: "Repeat buyers held up",
    tone: "text-emerald-300",
  },
  {
    label: "Traffic",
    value: "-8.1%",
    detail: "Paid sessions softened",
    tone: "text-amber-300",
  },
  {
    label: "Content",
    value: "+19%",
    detail: "IG reach improved",
    tone: "text-cyan-300",
  },
];

const REVIEW_POINTS = [
  "Inventory levels optimized across all channels.",
  "Ad spend shifted to high-ROAS creative clusters.",
  "Customer recovery sequence initiated for dormant segments.",
];

const WORKFLOWS = [
  {
    step: "01",
    title: "Connect your sources",
    detail:
      "Connect your commerce, marketing, inbox, and analytics tools so Rearvy can see the full context.",
    icon: Database,
  },
  {
    step: "02",
    title: "Ask what changed",
    detail:
      "Use natural language to get clear answers, summaries, and trading or review-ready guidance.",
    icon: MessageSquare,
  },
  {
    step: "03",
    title: "Act on the update",
    detail:
      "Review the insight card, launch the desktop app, or continue in the browser with the next best action.",
    icon: FileText,
  },
];

const FEATURE_CARDS = [
  {
    title: "AI Business Advisor",
    description:
      "Rearvy turns connected data into recommendations, summaries, and decision-ready insight for the next business move.",
    icon: LineChart,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200",
  },
  {
    title: "Chat With Your Data",
    description:
      "Ask plain-English questions across your synced sources and get contextual answers without digging through dashboards.",
    icon: MessageSquare,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  {
    title: "Live Data Visualization",
    description:
      "Track revenue, traffic, product, and order trends with responsive charts and review-ready summaries.",
    icon: BarChart3,
    tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  },
  {
    title: "Proactive Insights",
    description:
      "Rearvy flags notable changes, opportunities, and risk signals so you can react before the next meeting.",
    icon: Bell,
    tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200",
  },
  {
    title: "Trading Copilot",
    description:
      "The trading opinion flow now produces structured Buy, Sell, or Hold guidance with monitor controls in chat.",
    icon: CirclePlay,
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  },
  {
    title: "Desktop App & Updates",
    description:
      "Windows users can install Rearvy as a native app and receive built-in update prompts without bundling private secrets.",
    icon: Download,
    tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  },
];

function ProductPreview() {
  return (
    <div className="mx-auto w-full max-w-4xl rounded-lg border border-slate-800 bg-slate-950 p-3 text-white shadow-[0_24px_80px_rgba(15,23,42,0.35)]">
      <div className="flex items-center justify-between border-b border-white/10 px-2 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </div>
        <div className="hidden items-center gap-2 text-xs text-white/50 sm:flex">
          <span>Acme Skin Co.</span>
          <span className="h-1 w-1 rounded-full bg-white/30" />
          <span>Weekly review</span>
        </div>
        <span className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
          Ready
        </span>
      </div>
      <div className="grid gap-3 pt-3 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">
                Business Pulse
              </p>
              <h2 className="mt-2 text-2xl font-bold">Autonomous Actions</h2>
            </div>
            <LineChart className="h-5 w-5 text-cyan-200" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {HERO_METRICS.map((metric) => (
              <div key={metric.label} className="rounded-md border border-white/10 bg-slate-900/80 p-3">
                <p className="text-xs text-white/50">{metric.label}</p>
                <p className={`mt-2 text-2xl font-bold ${metric.tone}`}>{metric.value}</p>
                <p className="mt-1 text-xs leading-5 text-white/55">{metric.detail}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 rounded-md border border-white/10 bg-slate-900/70 p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-medium text-white/60">Revenue and traffic trend</p>
              <span className="text-xs text-white/40">Last 7 days</span>
            </div>
            <svg
              aria-hidden="true"
              className="h-28 w-full"
              viewBox="0 0 420 120"
              preserveAspectRatio="none"
            >
              <defs>
                <linearGradient id="heroRevenueFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 92 C42 82 58 46 105 58 C150 70 164 30 210 38 C248 45 256 84 294 72 C334 58 356 32 420 26 L420 120 L0 120 Z"
                fill="url(#heroRevenueFill)"
              />
              <path
                d="M0 92 C42 82 58 46 105 58 C150 70 164 30 210 38 C248 45 256 84 294 72 C334 58 356 32 420 26"
                fill="none"
                stroke="#34d399"
                strokeLinecap="round"
                strokeWidth="4"
              />
              <path
                d="M0 44 C48 40 72 54 112 50 C160 46 190 74 230 76 C282 80 308 88 350 78 C382 70 398 76 420 86"
                fill="none"
                stroke="#38bdf8"
                strokeDasharray="7 9"
                strokeLinecap="round"
                strokeWidth="3"
              />
            </svg>
          </div>
        </div>

        <div className="grid gap-3">
          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-200" />
              <p className="text-sm font-semibold">AI Decision</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Revenue is optimized. I've autonomously adjusted the ad spend to capitalize on high-intent traffic while pausing underperforming creative assets.
            </p>
            <div className="mt-4 space-y-2">
              {REVIEW_POINTS.map((point) => (
                <div key={point} className="flex gap-2 rounded-md bg-slate-900/80 p-2 text-xs leading-5 text-white/65">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-300" />
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/40">
              Connected sources
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {SUPPORTED_INTEGRATIONS.slice(0, 6).map((integration) => (
                <span key={integration} className="rounded-md border border-white/10 bg-slate-900/80 px-2 py-2 text-xs text-white/70">
                  {integration}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  const router = useRouter();

  useEffect(() => {
    if (isElectron()) {
      router.replace("/login");
    }
  }, [router]);

  return (
    <div className="dark">
      <div className="flex min-h-dvh flex-col bg-[#f7f7f2] text-slate-950 dark:bg-[#07090d] dark:text-slate-50">
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#f7f7f2]/95 backdrop-blur dark:border-white/10 dark:bg-[#07090d]/90">
        <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center">
            <Image
              src="/rearvy-wordmark.svg"
              alt="Rearvy"
              width={192}
              height={44}
              className="h-9 w-auto dark:invert"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300 md:flex">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="transition-colors hover:text-slate-950 dark:hover:text-white">
                {link.label}
              </Link>
            ))}
            <Link href="/demo" className="transition-colors hover:text-slate-950 dark:hover:text-white">
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link href="/download" className="hidden lg:block">
              <Button variant="outline" size="sm" className="border-slate-300 bg-white/70 dark:border-white/10 dark:bg-white/5">
                <Download className="h-4 w-4" />
                Download
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="text-slate-700 dark:text-slate-200">
                Sign in
              </Button>
            </Link>
            <Link href="/signup">
              <Button size="sm" className="bg-slate-950 text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                Start free
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <HeroClient />

        <section className="border-b border-slate-200 bg-white px-4 py-7 dark:border-white/10 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <p className="max-w-md text-sm font-medium text-slate-600 dark:text-slate-300">
              Connect the sources that usually decide the client conversation.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUPPORTED_INTEGRATIONS.map((integration) => (
                <span key={integration} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200">
                  {integration}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="workflows" className="px-4 py-20 dark:bg-[#07090d] sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  How it works
                </p>
                <h2 className="mt-4 max-w-xl text-3xl font-semibold tracking-tight sm:text-5xl">
                  Put your business on connected intelligence.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Rearvy replaces manual checking with a connected view of your business, then packages the result into a clear action for the team.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {WORKFLOWS.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-400">{item.step}</span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white dark:bg-white dark:text-slate-950">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="mt-8 text-xl font-semibold">{item.title}</h3>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-200 bg-slate-950 px-4 py-20 text-white dark:border-white/10 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
              <div className="lg:sticky lg:top-28">
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-200">
                  Why teams stay
                </p>
                <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                  Intelligence that turns updates into action.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-300">
                  Rearvy goes beyond reporting by combining connected data, natural-language chat, insight cards, and desktop access in one workflow.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <Users className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-semibold">Built for review teams</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <TrendingUp className="h-5 w-5 text-amber-300" />
                    <p className="mt-3 text-sm font-semibold">Focused on business shifts</p>
                  </div>
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <ShieldCheck className="h-5 w-5 text-cyan-300" />
                    <p className="mt-3 text-sm font-semibold">Grounded in connected sources</p>
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {FEATURE_CARDS.map((feature) => {
                  const Icon = feature.icon;

                  return (
                    <article key={feature.title} className="rounded-lg border border-white/10 bg-white/[0.04] p-5">
                      <div className={`mb-5 flex h-11 w-11 items-center justify-center rounded-md border ${feature.tone}`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                      <p className="mt-3 text-sm leading-6 text-slate-300">{feature.description}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 dark:bg-[#07090d] sm:px-6 sm:py-24">
          <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[1fr_1fr] lg:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Review-ready output
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                Scale without adding headcount.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Rearvy acts as a connected intelligence layer over your existing tools, helping you keep the business moving without adding more manual work.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/signup">
                  <Button size="lg" className="h-11 bg-slate-950 px-7 text-base text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                    Start free
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/features">
                  <Button size="lg" variant="outline" className="h-11 border-slate-300 bg-white/80 px-7 text-base dark:border-white/15 dark:bg-white/5">
                    View features
                  </Button>
                </Link>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.04]">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-white/10">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                    Business Pulse
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Autonomous Hub</h3>
                </div>
                <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Review ready
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  "Inventory reordered for high-velocity SKUs.",
                  "Ad budgets reallocated to top-performing search terms.",
                  "Email automation triggered for high-intent abandoned carts.",
                ].map((item) => (
                  <div key={item} className="flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="border-t border-slate-200 bg-white px-4 py-20 dark:border-white/10 dark:bg-slate-950 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mx-auto max-w-2xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Current access
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                Start free while the rollout is open.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Create an account and try the agency review workflow today.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-md gap-6">
              {REARVY_PLANS.map((plan) => (
                <article key={plan.id} className="rounded-lg border border-slate-900 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
                  <div className="flex items-start justify-between gap-5">
                    <div>
                      <h3 className="text-2xl font-semibold">{plan.name}</h3>
                      <p className="mt-2 text-sm leading-6 text-white/65">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-4xl font-semibold">{plan.price}</p>
                      <p className="text-sm text-white/55">{plan.period}</p>
                    </div>
                  </div>

                  <div className="mt-8 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 text-sm text-white/80">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <Link href="/signup" className="mt-8 block">
                    <Button size="lg" variant="secondary" className="h-11 w-full bg-white text-base text-slate-950 hover:bg-slate-200">
                      {plan.ctaLabel}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 py-16 dark:bg-[#07090d] sm:px-6 sm:py-20">
          <div className="mx-auto max-w-4xl rounded-lg border border-slate-200 bg-slate-950 p-8 text-center text-white shadow-xl shadow-slate-950/10 dark:border-white/10 sm:p-10">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Run your business on autopilot.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Sign in or start free to turn your connected data into a clearer, faster decision loop.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link href="/signup">
                <Button size="lg" variant="secondary" className="h-11 bg-white px-7 text-base text-slate-950 hover:bg-slate-200">
                  Start free
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="h-11 border-white/20 bg-white/5 px-7 text-base text-white hover:bg-white/10 hover:text-white">
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-8 text-sm text-slate-600 dark:border-white/10 dark:bg-slate-950 dark:text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <p>Rearvy AI - The connected business advisor for faster reviews and sharper next steps.</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <Link href="/features" className="underline-offset-4 hover:underline">
              Features
            </Link>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy
            </Link>
            <Link href="/data-delete" className="underline-offset-4 hover:underline">
              Data deletion
            </Link>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
    </div>
  );
}
