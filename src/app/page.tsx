import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { REARVY_PLANS } from "@/lib/plans";
import {
  ArrowRight,
  Bell,
  Check,
  FileText,
  FolderKanban,
  LineChart,
  MessageSquare,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

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

const AGENCY_WORKFLOWS = [
  {
    title: "Walk into client reviews prepared",
    detail:
      "Rearvy pulls the latest changes across connected sources, then turns them into a short brief your team can scan before the call starts.",
  },
  {
    title: "Explain what changed without spreadsheet hopping",
    detail:
      "Ask one question across revenue, traffic, content, inbox, and spreadsheet data instead of stitching answers together by hand.",
  },
  {
    title: "Package the next move for the client",
    detail:
      "Turn detected changes into plain-language recommendations, follow-up tasks, and report-ready summaries.",
  },
];

const FEATURE_CARDS = [
  {
    title: "Ask across client data",
    description:
      "Use natural language to answer weekly performance questions without jumping between tools.",
    icon: MessageSquare,
    previewLabel: "Question",
    previewTitle: "What changed for Acme this week?",
    previewValue: "3 material shifts",
    previewNote: "Traffic softened, repeat revenue held, and IG reach improved.",
  },
  {
    title: "Spot anomalies fast",
    description:
      "Rearvy highlights deltas worth explaining before a client asks about them first.",
    icon: Bell,
    previewLabel: "Alert",
    previewTitle: "Checkout rate dipped",
    previewValue: "Needs explanation",
    previewNote: "Sessions held steady while conversion fell versus baseline.",
  },
  {
    title: "Build weekly briefs",
    description:
      "Summarize the week into one concise memo with source-backed context and next steps.",
    icon: FileText,
    previewLabel: "Weekly brief",
    previewTitle: "Monday prep",
    previewValue: "Ready to send",
    previewNote: "Top wins, risks, and actions for the client team.",
  },
  {
    title: "Keep client context organized",
    description:
      "Use projects as client workspaces so chats, decisions, and notes stay attached to the right account.",
    icon: FolderKanban,
    previewLabel: "Workspace",
    previewTitle: "One client, one thread",
    previewValue: "Shared context",
    previewNote: "Campaign questions and follow-ups stay together.",
  },
  {
    title: "Cite the data source",
    description:
      "Recommendations work better when the team can trace them back to the integration that produced the signal.",
    icon: ShieldCheck,
    previewLabel: "Source clarity",
    previewTitle: "Linked to origin",
    previewValue: "Lower friction",
    previewNote: "Better trust during internal and client reviews.",
  },
  {
    title: "Stay lightweight",
    description:
      "The current stack favors speed to shipping: Next.js, Firebase, scheduled sync jobs, and AI-powered summaries.",
    icon: LineChart,
    previewLabel: "Stack",
    previewTitle: "Fast iteration",
    previewValue: "Lean by default",
    previewNote: "Built for a small team shipping quickly.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/50 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center">
          <Image
            src="/rearvy-wordmark.svg"
            alt="Rearvy"
            width={192}
            height={44}
            className="h-10 w-auto dark:invert"
            priority
          />
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-slate-700 to-slate-800 text-sm hover:shadow-lg hover:shadow-slate-500/20">
              Start free
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden px-4 py-20 sm:py-32">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-600/5 via-slate-700/5 to-transparent" />
          <div className="mx-auto max-w-6xl space-y-10 text-center">
            <div className="space-y-5">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-500/10 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                <Sparkles className="h-4 w-4" />
                For growth agencies running Shopify and DTC client accounts
              </div>
              <h1 className="mx-auto max-w-5xl text-5xl font-bold tracking-tight sm:text-7xl">
                <span className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-slate-100 dark:via-slate-300 dark:to-slate-400">
                  Spot what changed across client data and walk into the review call with answers.
                </span>
              </h1>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground sm:text-xl">
                Rearvy helps agency teams connect client data, explain the weekly shifts that matter,
                and package the next action without bouncing between dashboards, spreadsheets, and notes.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/demo">
                <Button size="lg" variant="outline" className="px-8 text-base">
                  Open Demo
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base shadow-lg shadow-slate-500/20 hover:shadow-slate-500/30"
                >
                  Start free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>

            <div className="mx-auto grid max-w-5xl gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-border/60 bg-card/90 p-6 text-left shadow-2xl backdrop-blur">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                      Weekly client brief
                    </p>
                    <h2 className="mt-2 text-2xl font-bold">Acme Skin Co.</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      This week's client-ready summary across commerce, traffic, and content.
                    </p>
                  </div>
                  <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    Review ready
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Revenue
                    </p>
                    <p className="mt-2 text-2xl font-bold">+12.4%</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Returning buyers held up despite softer paid traffic.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Traffic
                    </p>
                    <p className="mt-2 text-2xl font-bold">-8.1%</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      GA4 sessions dipped while top landing pages remained stable.
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border/60 bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      Content
                    </p>
                    <p className="mt-2 text-2xl font-bold">+19%</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Instagram reach rose and likely supported branded search demand.
                    </p>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-border/60 bg-background/70 p-5">
                  <p className="text-sm font-semibold">Recommended next action</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Check whether budget pacing or creative fatigue caused the traffic dip, then send the client a brief
                    that frames revenue resilience as the headline and paid efficiency as the investigation track.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 text-left">
                <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                    Why this matters
                  </p>
                  <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      Spend less time collecting updates before client meetings.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      Catch anomalies early enough to explain them confidently.
                    </li>
                    <li className="flex items-start gap-2">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      Give account managers a source-linked narrative, not another dashboard.
                    </li>
                  </ul>
                </div>

                <div className="rounded-3xl border border-border/60 bg-card p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                    Supported today
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {SUPPORTED_INTEGRATIONS.map((integration) => (
                      <span
                        key={integration}
                        className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs font-medium"
                      >
                        {integration}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 bg-gradient-to-b from-slate-50/80 via-background to-background px-4 py-20 sm:py-24 dark:from-slate-900/40">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-500/10 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4" />
                Built around agency review cycles, not vanity dashboards
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                What Rearvy should help an agency do well
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
                The product is strongest when it pulls scattered client signals into one answer, one brief, and one
                recommended next step.
              </p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur sm:p-8">
              <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                Real integrations currently implemented in this codebase
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {SUPPORTED_INTEGRATIONS.map((integration) => (
                  <div
                    key={integration}
                    className="rounded-xl border border-border/60 bg-background/70 px-3 py-3 text-center text-sm font-semibold text-foreground"
                  >
                    {integration}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {AGENCY_WORKFLOWS.map((item) => (
                <article
                  key={item.title}
                  className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Agency workflow
                  </p>
                  <h3 className="mt-2 text-xl font-bold">{item.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-[#0a0a0a] py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-16 space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Current product focus
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Rearvy should win by helping agency teams explain performance quickly, not by trying to be every tool.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_CARDS.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="group flex flex-col rounded-[1.5rem] border border-white/5 bg-[#111111] p-6 shadow-xl shadow-black/50 transition-all hover:border-white/10 hover:bg-[#151515] sm:p-8"
                  >
                    <div className="mb-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2a303c] shadow-inner">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                    <p className="text-[15px] leading-relaxed text-[#a1a1aa]">{feature.description}</p>
                    <div className="mt-6 rounded-2xl border border-[#27272a] bg-[#18181b] p-4">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
                        {feature.previewLabel}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-white">{feature.previewTitle}</p>
                      <div className="mt-3 flex items-center justify-between rounded-lg bg-[#22252d] px-3 py-2">
                        <span className="text-xs text-zinc-400">Live signal</span>
                        <span className="text-xs font-semibold text-white">{feature.previewValue}</span>
                      </div>
                      <p className="mt-3 text-xs text-zinc-400">{feature.previewNote}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-14 space-y-3 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-600">Current access</p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Free access during the current rollout
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Rearvy is currently open on a free access plan while the agency billing and onboarding path are being
                tightened up.
              </p>
            </div>

            <div className="mx-auto grid max-w-md gap-6">
              {REARVY_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-3xl border border-slate-700 bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/15"
                >
                  <div className="mb-8 flex items-start justify-between gap-4">
                    <div className="space-y-3">
                      <h3 className="text-2xl font-bold">{plan.name}</h3>
                      <p className="text-white/70">{plan.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-4xl font-bold">{plan.price}</div>
                      <div className="text-sm text-white/60">{plan.period}</div>
                    </div>
                  </div>

                  <div className="mb-8 space-y-3">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/12">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                        <span className="text-white/85">{feature}</span>
                      </div>
                    ))}
                  </div>

                  <p className="mb-6 text-sm text-white/60">
                    Agency pricing and higher-touch onboarding should go live only after the core agency workflow is
                    sharper and easier to trust.
                  </p>

                  <Link href="/signup">
                    <Button size="lg" variant="secondary" className="w-full bg-white text-slate-900 hover:bg-white/90">
                      {plan.ctaLabel}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border/50 px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">
              Built for the team that has to explain the numbers, not just collect them
            </h2>
            <p className="mx-auto mb-8 max-w-xl text-muted-foreground">
              Start with the demo or connect your first workspace and pressure-test whether Rearvy helps your agency
              answer client questions faster.
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base hover:shadow-lg hover:shadow-slate-500/30"
                >
                  Start free
                </Button>
              </Link>
              <Link href="/demo">
                <Button size="lg" variant="outline" className="border-2 px-8 text-base hover:bg-muted/50">
                  Open demo
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto space-y-4">
          <p>Rearvy AI - Agency review prep, connected data, and clear next actions.</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/features" className="underline-offset-4 hover:underline">
              Features
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/data-delete" className="underline-offset-4 hover:underline">
              Data Deletion
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms of Service
            </Link>
          </div>
          <p className="text-xs opacity-60">(c) 2026 Rearvy. Focused on connected data workflows for growth agencies.</p>
        </div>
      </footer>
    </div>
  );
}
