"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { isElectron } from "@/lib/utils/env";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import HeroClient from "@/components/home/HeroClient";
import B2BUseCaseCarousel from "@/components/home/B2BUseCaseCarousel";
import { REARVY_PLANS } from "@/lib/plans";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Check,
  Database,
  Download,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Clock,
  Zap,
  Target,
} from "lucide-react";

const NAV_LINKS = [
  { href: "#signals", label: "Signals" },
  { href: "#use-cases", label: "Use cases" },
  { href: "#proof", label: "Proof" },
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

const WORKFLOWS = [
  {
    step: "01",
    title: "Connect your business data",
    detail: "Connect commerce, marketing, analytics, and inboxes in minutes. Rearvy keeps the live feed flowing without manual refreshes.",
    icon: Database,
  },
  {
    step: "02",
    title: "Get the brief",
    detail: "Rearvy explains what changed, why it matters, and what action it enables. The signal is filtered down to one clear short list.",
    icon: Zap,
  },
  {
    step: "03",
    title: "Execute without switching tools",
    detail: "Approve actions from chat, dashboard alerts, or desktop workflows so the team moves from insight to motion faster.",
    icon: Target,
  },
];

const FEATURE_CARDS = [
  {
    title: "Unified operations brief",
    description:
      "See revenue, orders, metrics, and alerts from all your business tools in one place, distilled into one readable command center.",
    icon: BarChart3,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  {
    title: "Always-on anomaly radar",
    description:
      "Rearvy watches 24/7 and surfaces unusual changes before they become expensive surprises—drops, spikes, and inventory risk.",
    icon: Bell,
    tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  },
  {
    title: "AI context that explains itself",
    description:
      "Get plain-English business context: what changed, why it happened, and what to do next.",
    icon: Zap,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200",
  },
  {
    title: "Natural-language control",
    description:
      "Ask any business question and get an answer in plain English, whether you need revenue trends, client status, or a next-step summary.",
    icon: MessageSquare,
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  },
  {
    title: "Fast action layer",
    description:
      "Execute business moves directly from Rearvy: send campaigns, adjust budgets, reorder inventory, or scale your agent.",
    icon: Target,
    tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200",
  },
  {
    title: "Windows desktop app",
    description:
      "Install Rearvy on Windows for native performance and always-on monitoring. Auto-updates keep you current without version drift.",
    icon: Download,
    tone: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-400/20 dark:bg-rose-400/10 dark:text-rose-200",
  },
];

const TRUST_SIGNALS = [
  {
    title: "Time to Revenue Impact",
    value: "2.1 hours",
    detail: "From discovering a trend to executing action, teams report measurable decisions the same day.",
    icon: Clock,
  },
  {
    title: "Integrations Live",
    value: "8+",
    detail: "Shopify, Google Analytics, Stripe, Facebook, Instagram, YouTube, Gmail, and Razorpay are wired in.",
    icon: ShieldCheck,
  },
  {
    title: "Alert Accuracy",
    value: "94%",
    detail: "Real anomalies you care about. Smart filtering means fewer false positives and more high-signal notifications.",
    icon: Target,
  },
];

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

          {!isElectron() && (
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
          )}

          <div className="flex items-center gap-2">
            {!isElectron() && (
              <Link href="/download" className="hidden lg:block">
                <Button variant="outline" size="sm" className="border-slate-300 bg-white/70 dark:border-white/10 dark:bg-white/5">
                  <Download className="h-4 w-4" />
                  Download
                </Button>
              </Link>
            )}
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

        <section id="signals" className="border-b border-slate-200 bg-white px-4 py-8 dark:border-white/10 dark:bg-slate-950 sm:px-6">
          <div className="mx-auto grid max-w-7xl gap-4 lg:grid-cols-[0.95fr_1.05fr] lg:items-stretch">
            <div className="rounded-[28px] border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-6 shadow-sm dark:border-white/10 dark:from-white/[0.05] dark:to-white/[0.02]">
              <p className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-400">
                Signal layer
              </p>
              <h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-4xl">
                Clear proof before the pitch.
              </h2>
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 dark:text-slate-300">
                Rearvy connects the tools your team already trusts, then turns the noise into a short, readable brief that is easier to act on than a dashboard full of tabs.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {TRUST_SIGNALS.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                      <Icon className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
                    </div>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">{item.value}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
                  </article>
                );
              })}
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-950/5 lg:col-span-2 dark:border-white/10">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-200/80">
                    Connected sources
                  </p>
                  <p className="mt-2 text-lg text-white/75">
                    The same sources your team already uses, now arranged as one operating surface.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  {SUPPORTED_INTEGRATIONS.map((integration) => (
                    <span key={integration} className="rounded-full border border-white/10 bg-white/[0.05] px-3 py-1.5 text-xs font-semibold text-white/80">
                      {integration}
                    </span>
                  ))}
                </div>
              </div>
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
                  From raw updates to a clear next move.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Replace manual checking with one connected command center for insight, action, and follow-through.
              </p>
            </div>

            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {WORKFLOWS.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-sm transition-transform duration-300 hover:-translate-y-1 dark:border-white/10 dark:bg-white/[0.04]">
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

        <section id="use-cases" className="px-4 py-20 dark:bg-slate-900/30 sm:px-6 sm:py-24">
          <div className="mx-auto max-w-7xl">
            <div className="mb-12 text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Built for your business
              </p>
              <h2 className="mt-4 text-3xl font-semibold tracking-tight sm:text-5xl">
                See how teams like yours use Rearvy.
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Move from one-off questions to repeatable operating patterns for agencies, SaaS teams, and e-commerce operators.
              </p>
            </div>
            <div className="rounded-[32px] border border-slate-200 bg-white p-4 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.03] sm:p-6">
              <B2BUseCaseCarousel />
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
                  Intelligence that drives outcomes.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-300">
                  Rearvy combines connected data, AI-Trader signals, natural-language chat, and desktop execution in one operating loop.
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
                    <article key={feature.title} className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 transition-transform duration-300 hover:-translate-y-1">
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

        <section id="proof" className="border-y border-slate-200 bg-white px-4 py-16 dark:border-white/10 dark:bg-slate-950 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-7xl">
            <div className="mb-8 max-w-3xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                Proof of value
              </p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                Built to move faster than dashboard-only teams.
              </h2>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {TRUST_SIGNALS.map((item) => {
                const Icon = item.icon;

                return (
                  <article key={item.title} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-5 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{item.title}</p>
                      <Icon className="h-5 w-5 text-cyan-500 dark:text-cyan-300" />
                    </div>
                    <p className="mt-4 text-4xl font-semibold tracking-tight">{item.value}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.detail}</p>
                  </article>
                );
              })}
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
                Scale revenue operations without adding dashboard fatigue.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Rearvy acts as a connected intelligence layer over your existing stack so your team spends less time assembling updates and more time shipping decisions.
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

            <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-xl shadow-slate-950/5 dark:border-white/10 dark:bg-white/[0.04]">
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
                Start free and launch your first AI operating loop.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Connect sources, verify insights, and run web + desktop workflows from day one.
              </p>
            </div>

            <div className="mx-auto mt-10 grid max-w-md gap-6">
              {REARVY_PLANS.map((plan) => (
                <article key={plan.id} className="rounded-[28px] border border-slate-900 bg-slate-950 p-6 text-white shadow-xl shadow-slate-950/15">
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
          <div className="mx-auto max-w-4xl rounded-[32px] border border-slate-200 bg-slate-950 p-8 text-center text-white shadow-xl shadow-slate-950/10 dark:border-white/10 sm:p-10">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">
              Turn weekly review chaos into daily execution.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Start free and see how Rearvy combines connected business insight with actionable AI flows.
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
          <p>Rearvy AI - The connected operating layer for faster reviews and sharper next steps.</p>
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
