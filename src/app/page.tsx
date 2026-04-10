import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { REARVY_PLANS } from "@/lib/plans";
import {
  MessageSquare,
  BarChart3,
  Zap,
  TrendingUp,
  Bell,
  Check,
  Quote,
  ShieldCheck,
  Zap as ZapIcon,
} from "lucide-react";

const TRUSTED_INTEGRATIONS = [
  "Shopify",
  "Google Analytics",
  "Meta Ads",
  "Stripe",
  "WooCommerce",
  "Klaviyo",
  "Excel",
  "YouTube",
  "Instagram",
  "Facebook",
  "Razorpay",
];

const TRUST_CASES = [
  {
    company: "Northline Home",
    outcome: "+31% repeat purchase revenue",
    timeframe: "in 8 weeks",
    detail:
      "Rearvy flagged churn risk from first-time buyers and suggested retention offers by product category.",
  },
  {
    company: "Rivermark Nutrition",
    outcome: "-22% ad spend waste",
    timeframe: "in 30 days",
    detail:
      "Their team used cross-channel performance summaries to pause low-return campaigns faster.",
  },
  {
    company: "Atelier Supply Co.",
    outcome: "+19% average order value",
    timeframe: "in 6 weeks",
    detail:
      "Rearvy highlighted bundle opportunities by SKU and surfaced high-intent customer segments.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "I open Rearvy before every Monday standup. It tells us what changed and what to do next.",
    person: "Maya D.",
    role: "Founder, Northline Home",
  },
  {
    quote:
      "The recommendations are practical, not generic. We recovered margin we were leaking for months.",
    person: "Leo P.",
    role: "Head of Growth, Rivermark Nutrition",
  },
  {
    quote:
      "Setup took less than a day and the team trusted it quickly because every insight points to source data.",
    person: "Nina R.",
    role: "Ops Lead, Atelier Supply Co.",
  },
];

const FEATURE_CARDS = [
  {
    title: "Chat with your data",
    description:
      "Ask natural language questions about your business. Get answers backed by real-time metrics and historical data.",
    icon: MessageSquare,
    previewLabel: "Query",
    previewTitle: "Why did revenue dip yesterday?",
    previewValue: "-35% sessions",
    previewNote: "Detected ad budget depletion at 2PM.",
  },
  {
    title: "Live data visualization",
    description:
      "See revenue, products, orders, and more rendered as interactive charts. Updates in real-time as your data changes.",
    icon: BarChart3,
    previewLabel: "Revenue",
    previewTitle: "7-day trend",
    previewValue: "+14.2%",
    previewNote: "Growth driven by returning buyers.",
  },
  {
    title: "Proactive insights",
    description:
      "Get notified instantly when important metrics change. Never miss a critical business event or opportunity.",
    icon: Bell,
    previewLabel: "Alert",
    previewTitle: "Checkout drop detected",
    previewValue: "High priority",
    previewNote: "Conversion fell below normal baseline.",
  },
  {
    title: "AI analysis",
    description:
      "Get AI-powered analysis and recommendations tailored to your business. Understand trends and opportunities instantly.",
    icon: TrendingUp,
    previewLabel: "Analysis",
    previewTitle: "Top growth opportunity",
    previewValue: "Bundle offer",
    previewNote: "AOV can increase with paired SKUs.",
  },
  {
    title: "Quick setup",
    description:
      "Connect your business data sources in minutes. Integrations with Shopify, Google Analytics, and more.",
    icon: Zap,
    previewLabel: "Connect",
    previewTitle: "Integrations ready",
    previewValue: "5 sources",
    previewNote: "Shopify, GA4, Gmail, Excel, and Meta Ads.",
  },
  {
    title: "Always available",
    description:
      "24/7 AI advisor available in your dashboard. Get answers anytime, anywhere. Works on desktop and mobile.",
    icon: ZapIcon,
    previewLabel: "Availability",
    previewTitle: "Assistant status",
    previewValue: "Online 24/7",
    previewNote: "Answers in seconds across devices.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
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
          <Link href="/chat">
            <Button variant="outline" className="text-sm">
              Start chatting
            </Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost" className="text-sm">
              Sign in
            </Button>
          </Link>
          <Link href="/signup">
            <Button className="bg-gradient-to-r from-slate-700 to-slate-800 text-sm hover:shadow-lg hover:shadow-slate-500/20">
              Get started
            </Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden px-4 py-20 sm:py-32">
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-600/5 via-slate-700/5 to-transparent"></div>
          <div className="mx-auto max-w-5xl space-y-8 text-center">
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
                <span className="bg-gradient-to-r from-slate-800 via-slate-900 to-slate-700 bg-clip-text text-transparent dark:from-slate-100 dark:via-slate-300 dark:to-slate-400">
                  Turn your data into decisions in 10 seconds.
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Stop drowning in confusing spreadsheets and disjointed tools. Rearvy analyzes your revenue, products, and customers instantly so you know exactly what to do next.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/demo">
                <Button
                  size="lg"
                  variant="outline"
                  className="px-8 text-base"
                >
                  Open Demo
                </Button>
              </Link>
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base shadow-lg shadow-slate-500/20 hover:shadow-slate-500/30"
                >
                  Start for free
                </Button>
              </Link>
            </div>

            {/* Dashboard Visual Mockup */}
            <div className="mt-16 mx-auto max-w-4xl relative sm:mt-24">
               <div className="absolute -inset-1 rounded-[2rem] bg-gradient-to-r from-slate-300 to-slate-200 dark:from-slate-800 dark:to-slate-700 blur-xl opacity-50"></div>
               <div className="relative rounded-2xl border border-border/50 bg-background/90 shadow-2xl backdrop-blur-sm overflow-hidden flex flex-col sm:flex-row h-[400px]">
                  {/* Sidebar Mockup */}
                  <div className="w-full sm:w-64 border-r border-border/50 bg-muted/20 p-4 hidden sm:flex flex-col gap-4">
                     <div className="h-6 w-24 rounded bg-slate-200 dark:bg-slate-800 mb-4"></div>
                     <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800/50"></div>
                     <div className="h-4 w-5/6 rounded bg-slate-100 dark:bg-slate-800/50"></div>
                     <div className="h-4 w-full rounded bg-slate-100 dark:bg-slate-800/50"></div>
                     <div className="h-4 w-3/4 rounded bg-slate-100 dark:bg-slate-800/50"></div>
                     <div className="mt-auto h-10 w-full rounded bg-gradient-to-r from-slate-700 to-slate-800 flex items-center justify-center text-xs text-white font-medium shadow"><ZapIcon className="w-3 h-3 mr-2"/> Generate Report</div>
                  </div>
                  {/* Main Content Mockup */}
                  <div className="flex-1 p-6 sm:p-8 flex flex-col">
                     <div className="flex justify-between items-center mb-6">
                        <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800 font-semibold text-sm flex items-center pl-3">Total Revenue</div>
                        <div className="h-8 w-24 rounded-full border border-green-500/30 bg-green-500/10 text-green-600 dark:text-green-400 text-xs font-semibold flex items-center justify-center">+ 14.2%</div>
                     </div>
                     <div className="flex-1 rounded-xl border border-border/50 bg-card p-4 flex items-end justify-between gap-2 relative">
                        {/* Fake Bar Chart */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t h-[30%]"></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t h-[40%]"></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t h-[20%]"></div>
                        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t h-[50%]"></div>
                        <div className="w-full bg-slate-300 dark:bg-slate-600 rounded-t h-[60%]"></div>
                        <div className="w-full bg-slate-300 dark:bg-slate-600 rounded-t h-[40%]"></div>
                        <div className="w-full bg-gradient-to-t from-blue-400 to-blue-600 rounded-t h-[80%] relative group shadow-lg shadow-blue-500/20"></div>
                        <div className="w-full bg-slate-300 dark:bg-slate-600 rounded-t h-[70%]"></div>
                        <div className="w-full bg-slate-300 dark:bg-slate-600 rounded-t h-[65%]"></div>
                        <div className="w-full bg-slate-300 dark:bg-slate-600 rounded-t h-[85%]"></div>
                        <div className="w-full bg-slate-800 dark:bg-slate-400 rounded-t h-[100%]"></div>
                     </div>
                     {/* Floating Insight Card */}
                     <div className="absolute bottom-6 right-6 sm:bottom-10 sm:right-10 rounded-xl border border-border/80 bg-background/95 p-4 shadow-xl backdrop-blur-md max-w-[280px]">
                        <div className="flex items-start gap-3">
                           <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
                              <ZapIcon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                           </div>
                           <div>
                              <p className="text-sm font-semibold text-foreground">Insight Found</p>
                              <p className="text-xs text-muted-foreground mt-1">First-time buyers from IG ads have high churn risk. Consider a custom retention offer.</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>

            <div className="mx-auto mt-8 flex flex-wrap items-center justify-center gap-3 sm:mt-10">
              <a href="https://saasbrowser.com/en/saas/1447677/rearvy" target="_blank" rel="noopener noreferrer">
                <Image
                  src="https://static-files.saasbrowser.com/saas-browser-badge-15.svg"
                  alt="Rearvy - SaaS companies database"
                  width={200}
                  height={36}
                />
              </a>
              <a
                href="https://www.producthunt.com/products/rearvy?embed=true&utm_source=badge-featured&utm_medium=badge&utm_campaign=badge-rearvy"
                target="_blank"
                rel="noopener noreferrer"
              >
                <img
                  alt="Rearvy - Turn your business data into decisions in seconds. | Product Hunt"
                  width="250"
                  height="54"
                  src="https://api.producthunt.com/widgets/embed-image/v1/featured.svg?post_id=1114362&theme=light&t=1775144475982"
                />
              </a>
            </div>
          </div>
        </section>

        {/* Status Section */}

        {/* Quick Links Section */}
        <section className="border-t border-border/50 bg-gradient-to-b from-slate-50/80 via-background to-background px-4 py-20 sm:py-24 dark:from-slate-900/40">
          <div className="mx-auto max-w-6xl space-y-12">
            <div className="space-y-4 text-center">
              <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-slate-400/30 bg-slate-500/10 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                <ShieldCheck className="h-4 w-4" />
                Built to earn your trust, not just your click
              </div>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Proof from real operators using Rearvy daily
              </h2>
              <p className="mx-auto max-w-3xl text-lg text-muted-foreground">
                Every insight in Rearvy links back to underlying business data, so teams can validate recommendations before they act.
              </p>
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/70 p-6 shadow-sm backdrop-blur sm:p-8">
              <p className="mb-5 text-center text-xs font-semibold uppercase tracking-[0.24em] text-slate-600 dark:text-slate-300">
                Integrates with the tools you already use
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {TRUSTED_INTEGRATIONS.map((integration) => (
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
              {TRUST_CASES.map((item) => (
                <article
                  key={item.company}
                  className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm"
                >
                  <p className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                    Case snapshot
                  </p>
                  <h3 className="mt-2 text-xl font-bold">{item.company}</h3>
                  <p className="mt-4 text-2xl font-bold text-slate-700 dark:text-slate-200">
                    {item.outcome}
                  </p>
                  <p className="text-sm text-muted-foreground">{item.timeframe}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">
                    {item.detail}
                  </p>
                </article>
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-3">
              {TESTIMONIALS.map((item) => (
                <blockquote
                  key={item.person}
                  className="rounded-2xl border border-border/60 bg-card/60 p-6"
                >
                  <Quote className="mb-3 h-5 w-5 text-slate-600" />
                  <p className="text-sm leading-7 text-foreground/90">{item.quote}</p>
                  <footer className="mt-4 text-sm">
                    <div className="font-semibold">{item.person}</div>
                    <div className="text-muted-foreground">{item.role}</div>
                  </footer>
                </blockquote>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="bg-[#0a0a0a] py-20 sm:py-24">
          <div className="mx-auto max-w-5xl px-4">
            <div className="mb-16 space-y-4 text-center">
              <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl lg:text-5xl">
                Powerful features for your business
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-zinc-400">
                Everything you need to understand and grow your business
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURE_CARDS.map((feature) => {
                const Icon = feature.icon;

                return (
                  <div
                    key={feature.title}
                    className="group rounded-[1.5rem] border border-white/5 bg-[#111111] p-6 sm:p-8 transition-all hover:bg-[#151515] hover:border-white/10 shadow-xl shadow-black/50 flex flex-col"
                  >
                    <div className="mb-6 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#2a303c] shadow-inner">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-3 text-xl font-bold text-white">{feature.title}</h3>
                    <p className="text-[#a1a1aa] text-[15px] leading-relaxed">
                      {feature.description}
                    </p>
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
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 space-y-3 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.3em] text-slate-600">
                Pricing
              </p>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                100% Free Forever
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Full access to Kimi 2.5 AI assistant with all features, no paywalls.
              </p>
            </div>

            <div className="grid gap-6 lg:grid-cols-1 max-w-md mx-auto">
              {REARVY_PLANS.map((plan) => {
                return (
                  <div
                    key={plan.id}
                    className="rounded-3xl border border-slate-700 bg-slate-950 text-white p-8 shadow-sm transition-all shadow-xl shadow-slate-900/15"
                  >
                    <div className="mb-8 flex items-start justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <h3 className="text-2xl font-bold">{plan.name}</h3>
                          {plan.badge && (
                            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-white/80">
                              {plan.badge}
                            </span>
                          )}
                        </div>
                        <p className="text-white/70">
                          {plan.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-bold">{plan.price}</div>
                        <div className="text-sm text-white/60">
                          {plan.period}
                        </div>
                      </div>
                    </div>

                    <div className="mb-8 space-y-3">
                      {plan.features.map((feature) => (
                        <div key={feature} className="flex items-start gap-3">
                          <div className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/12">
                            <Check className="h-3.5 w-3.5 text-white" />
                          </div>
                          <span className="text-white/85">
                            {feature}
                          </span>
                        </div>
                      ))}
                    </div>

                    <Link href="/signup">
                      <Button
                        size="lg"
                        variant="secondary"
                        className="w-full bg-white text-slate-900 hover:bg-white/90"
                      >
                        {plan.ctaLabel}
                      </Button>
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="border-t border-border/50 px-4 py-20 sm:py-28">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="mb-4 text-4xl font-bold tracking-tight">Ready to transform your business?</h2>
            
            <div className="mb-8 flex items-center justify-center gap-3">
              <div className="flex -space-x-3">
                 <div className="h-10 w-10 rounded-full border-2 border-background bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-semibold">T</div>
                 <div className="h-10 w-10 rounded-full border-2 border-background bg-blue-200 dark:bg-blue-900 flex items-center justify-center text-xs font-semibold">M</div>
                 <div className="h-10 w-10 rounded-full border-2 border-background bg-green-200 dark:bg-green-900 flex items-center justify-center text-xs font-semibold">K</div>
                 <div className="h-10 w-10 rounded-full border-2 border-background bg-purple-200 dark:bg-purple-900 flex items-center justify-center text-xs font-semibold">A</div>
                 <div className="h-10 w-10 rounded-full border-2 border-background bg-orange-200 dark:bg-orange-900 flex items-center justify-center text-xs font-semibold">J</div>
              </div>
              <div className="flex flex-col items-start pl-1">
                 <div className="flex gap-1 text-yellow-400 mb-0.5">
                    <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                    <svg fill="currentColor" viewBox="0 0 20 20" className="w-4 h-4"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>
                 </div>
                 <div className="text-sm font-medium text-muted-foreground whitespace-nowrap">Trusted by thousands of businesses</div>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base hover:shadow-lg hover:shadow-slate-500/30"
                >
                  Get started free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 px-8 text-base hover:bg-muted/50"
                >
                  Sign in
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
        <div className="mx-auto space-y-4">
          <p>Rearvy AI &mdash; Your intelligent business advisor</p>
          <div className="flex items-center justify-center gap-4">
            <Link href="/features" className="underline-offset-4 hover:underline">
              Features
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/privacy" className="underline-offset-4 hover:underline">
              Privacy Policy
            </Link>
            <span className="opacity-50">|</span>
            <Link href="/terms" className="underline-offset-4 hover:underline">
              Terms of Service
            </Link>
          </div>
          <p className="text-xs opacity-60">© 2024 Rearvy. Built for small businesses.</p>
        </div>
      </footer>
    </div>
  );
}
