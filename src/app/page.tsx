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
  Zap as ZapIcon,
} from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-background via-background to-muted/20">
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border/50 bg-background/95 px-6 py-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center">
          <Image
            src="/rearvy-wordmark.svg"
            alt="Kimi 2"
            width={192}
            height={44}
            className="h-10 w-auto"
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
              <div className="mx-auto inline-flex items-center rounded-full border border-slate-500/20 bg-slate-500/10 px-4 py-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">
                AI beta: insights and recommendations are still being refined.
              </div>
              <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
                <span className="bg-gradient-to-r from-slate-700 via-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Your AI Business Advisor
                </span>
              </h1>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground sm:text-xl">
                Connect your business data sources and get AI-powered insights in beta. Make smarter decisions with real-time analytics and recommendations while we continue improving accuracy.
              </p>
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/signup">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-slate-700 to-slate-800 px-8 text-base hover:shadow-lg hover:shadow-slate-500/30"
                >
                  Start for free
                </Button>
              </Link>
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 px-8 text-base hover:bg-muted/50"
                >
                  View demo
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-t border-border/50 bg-muted/30 px-4 py-20 sm:py-24">
          <div className="mx-auto max-w-5xl">
            <div className="mb-16 space-y-3 text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Powerful features for your business
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Everything you need to understand and grow your business
              </p>
            </div>

            {/* Feature Grid */}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {/* Feature 1 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-500/30 hover:bg-card hover:shadow-lg hover:shadow-slate-500/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Chat with your data</h3>
                <p className="text-muted-foreground">
                  Ask natural language questions about your business. Get answers backed by real-time metrics and historical data.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-600/30 hover:bg-card hover:shadow-lg hover:shadow-slate-600/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Live data visualization</h3>
                <p className="text-muted-foreground">
                  See revenue, products, orders, and more rendered as interactive charts. Updates in real-time as your data changes.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-500/30 hover:bg-card hover:shadow-lg hover:shadow-slate-500/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700">
                  <Bell className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Proactive insights</h3>
                <p className="text-muted-foreground">
                  Get notified instantly when important metrics change. Never miss a critical business event or opportunity.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-600/30 hover:bg-card hover:shadow-lg hover:shadow-slate-600/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800">
                  <TrendingUp className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">AI analysis</h3>
                <p className="text-muted-foreground">
                  Get AI-powered analysis and recommendations tailored to your business. Understand trends and opportunities instantly.
                </p>
              </div>

              {/* Feature 5 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-500/30 hover:bg-card hover:shadow-lg hover:shadow-slate-500/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-600 to-slate-700">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Quick setup</h3>
                <p className="text-muted-foreground">
                  Connect your business data sources in minutes. Integrations with Shopify, Google Analytics, and more.
                </p>
              </div>

              {/* Feature 6 */}
              <div className="group rounded-2xl border border-border/50 bg-card/50 p-8 backdrop-blur transition-all duration-300 hover:border-slate-600/30 hover:bg-card hover:shadow-lg hover:shadow-slate-600/10">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-800">
                  <ZapIcon className="h-6 w-6 text-white" />
                </div>
                <h3 className="mb-2 text-xl font-bold">Always available</h3>
                <p className="text-muted-foreground">
                  24/7 AI advisor available in your dashboard. Get answers anytime, anywhere. Works on desktop and mobile.
                </p>
              </div>
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
            <p className="mb-8 text-lg text-muted-foreground">
              Join thousands of businesses using Rearvy to make smarter decisions.
            </p>
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
