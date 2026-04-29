import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
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
  FolderKanban,
  LineChart,
  MessageSquare,
  ShieldCheck,
  TrendingUp,
  Users,
  Zap,
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
  "Free access during rollout",
  "Demo workspace included",
  "Built for weekly review prep",
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
  "Revenue is up, but paid traffic is the risk to explain.",
  "Returning customers are carrying the week.",
  "Send the client a short action list before the call.",
];

const WORKFLOWS = [
  {
    step: "01",
    title: "Connect the client workspace",
    detail:
      "Bring commerce, traffic, content, payments, inbox context, and spreadsheet data into one place.",
    icon: Database,
  },
  {
    step: "02",
    title: "Ask what changed",
    detail:
      "Rearvy turns scattered signals into a plain-language answer with the numbers that matter.",
    icon: MessageSquare,
  },
  {
    step: "03",
    title: "Walk in with the story",
    detail:
      "Account managers get a client-ready brief, next actions, and source context before the review starts.",
    icon: FileText,
  },
];

const FEATURE_CARDS = [
  {
    title: "One answer across tools",
    description:
      "Ask a client question once and pull context from connected sources instead of rebuilding the story tab by tab.",
    icon: MessageSquare,
    tone: "border-cyan-200 bg-cyan-50 text-cyan-700 dark:border-cyan-400/20 dark:bg-cyan-400/10 dark:text-cyan-200",
  },
  {
    title: "Weekly briefs that sell clarity",
    description:
      "Package what changed, why it matters, and what to do next into a short review-ready memo.",
    icon: FileText,
    tone: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200",
  },
  {
    title: "Signals before surprises",
    description:
      "Spot revenue, traffic, content, and collections shifts early enough to explain them with confidence.",
    icon: Bell,
    tone: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-200",
  },
  {
    title: "Client workspaces",
    description:
      "Keep chats, notes, decisions, and data attached to the right client account or campaign.",
    icon: FolderKanban,
    tone: "border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-200",
  },
  {
    title: "Source-linked confidence",
    description:
      "Make every recommendation easier to trust by tying it back to the source that produced the signal.",
    icon: ShieldCheck,
    tone: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200",
  },
  {
    title: "Fast, lightweight rollout",
    description:
      "A focused workspace for agencies that need useful review prep now, without a heavy BI implementation.",
    icon: Zap,
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
                Client brief
              </p>
              <h2 className="mt-2 text-2xl font-bold">Monday call prep</h2>
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
              <p className="text-sm font-semibold">Rearvy answer</p>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/70">
              Revenue resilience is the headline. The risk to explain is paid traffic softening while repeat buyers
              continue to support the week.
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
  return (
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
        <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[#f7f7f2] dark:border-white/10 dark:bg-[#07090d]">
          <div className="absolute inset-0 -z-20 bg-[linear-gradient(135deg,rgba(15,23,42,0.06),rgba(20,184,166,0.08)_42%,rgba(245,158,11,0.08))] dark:bg-[linear-gradient(135deg,rgba(20,184,166,0.12),rgba(15,23,42,0.7)_45%,rgba(245,158,11,0.1))]" />
          <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(15,23,42,0.08)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,23,42,0.08)_1px,transparent_1px)] bg-[size:44px_44px] opacity-20 dark:opacity-15" />

          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:py-14">
            <div className="relative overflow-hidden rounded-lg border border-slate-200/70 bg-white/50 p-5 shadow-[0_20px_80px_rgba(15,23,42,0.08)] backdrop-blur dark:border-white/10 dark:bg-white/[0.03] sm:p-8 lg:min-h-[620px] lg:p-10">
              <div className="pointer-events-none absolute bottom-8 right-0 top-10 hidden w-[54%] opacity-95 lg:block">
                <ProductPreview />
              </div>
              <div className="pointer-events-none absolute inset-y-0 left-0 hidden w-[64%] bg-gradient-to-r from-white via-white/95 to-white/0 dark:from-[#07090d] dark:via-[#07090d]/95 dark:to-[#07090d]/0 lg:block" />

              <div className="relative z-10 max-w-2xl py-4 lg:py-20">
                <p className="mb-5 text-sm font-semibold uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">
                  Rearvy AI workspace
                </p>
                <h1 className="max-w-xl text-5xl font-semibold tracking-tight text-slate-950 dark:text-white sm:text-6xl">
                  AI review prep for growth agencies.
                </h1>
                <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600 dark:text-slate-300 sm:text-xl">
                  Connect client data, spot the shifts that matter, and walk into every review call with a brief your
                  team can use immediately.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link href="/signup">
                    <Button size="lg" className="h-11 bg-slate-950 px-7 text-base text-white shadow-lg shadow-slate-950/15 hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200">
                      Start free
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline" className="h-11 border-slate-300 bg-white/80 px-7 text-base dark:border-white/15 dark:bg-white/5">
                      Sign in
                    </Button>
                  </Link>
                  <Link href="/demo">
                    <Button size="lg" variant="ghost" className="h-11 px-5 text-base text-slate-700 dark:text-slate-200">
                      <CirclePlay className="h-4 w-4" />
                      Demo
                    </Button>
                  </Link>
                </div>

                <div className="mt-8 grid max-w-xl gap-2 text-sm text-slate-600 dark:text-slate-300 sm:grid-cols-2">
                  {HERO_POINTS.map((point) => (
                    <div key={point} className="flex items-center gap-2">
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                      <span>{point}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative z-10 mt-8 lg:hidden">
                <ProductPreview />
              </div>
            </div>
          </div>
        </section>

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
                  From scattered dashboards to a client-ready story.
                </h2>
              </div>
              <p className="max-w-2xl text-lg leading-8 text-slate-600 dark:text-slate-300">
                Rearvy is designed around the moment before the review call, when the team needs a clear answer,
                not another place to search.
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
                  Clarity that keeps account teams coming back.
                </h2>
                <p className="mt-5 text-lg leading-8 text-slate-300">
                  Rearvy keeps the promise simple: fewer prep tabs, better review calls, and clearer next actions for
                  every client account.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                  <div className="rounded-lg border border-white/10 bg-white/[0.04] p-4">
                    <Users className="h-5 w-5 text-emerald-300" />
                    <p className="mt-3 text-sm font-semibold">Built for account teams</p>
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
                Give every client call a sharper opening.
              </h2>
              <p className="mt-5 text-lg leading-8 text-slate-600 dark:text-slate-300">
                Rearvy helps turn the weekly mess into a concise brief: what moved, why it matters, and what the team
                should do next.
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
                    Client brief
                  </p>
                  <h3 className="mt-2 text-2xl font-semibold">Acme Skin Co.</h3>
                </div>
                <span className="rounded-md bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200">
                  Review ready
                </span>
              </div>

              <div className="mt-5 space-y-3">
                {[
                  "Lead with revenue resilience and repeat buyers.",
                  "Explain the traffic dip as a paid acquisition investigation.",
                  "Recommend a creative fatigue check before the next spend increase.",
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
              Start every client review with answers.
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-300">
              Sign in or start free to turn connected client data into a sharper weekly brief.
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
          <p>Rearvy AI - Agency review prep, connected data, and clear next actions.</p>
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
  );
}
