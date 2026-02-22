import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Sparkles, MessageSquare, BarChart3, Zap } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold">Rearvy</span>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost">Sign in</Button>
          </Link>
          <Link href="/signup">
            <Button>Get started</Button>
          </Link>
        </div>
      </header>

      {/* Hero */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="mx-auto max-w-3xl space-y-6">
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Your AI business advisor
          </h1>
          <p className="mx-auto max-w-xl text-lg text-muted-foreground">
            Rearvy connects to your Shopify store and social channels, then uses
            AI to help you make smarter decisions with your own data.
          </p>
          <div className="flex justify-center gap-3">
            <Link href="/signup">
              <Button size="lg">Start for free</Button>
            </Link>
          </div>
        </div>

        {/* Feature pills */}
        <div className="mt-16 grid max-w-2xl gap-4 sm:grid-cols-3">
          <div className="flex flex-col items-center gap-2 rounded-xl border p-6">
            <MessageSquare className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Chat with your data</h3>
            <p className="text-sm text-muted-foreground">
              Ask questions. Get answers backed by real metrics.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border p-6">
            <BarChart3 className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Live data cards</h3>
            <p className="text-sm text-muted-foreground">
              Revenue, products, orders rendered inline as charts.
            </p>
          </div>
          <div className="flex flex-col items-center gap-2 rounded-xl border p-6">
            <Zap className="h-8 w-8 text-primary" />
            <h3 className="font-semibold">Proactive insights</h3>
            <p className="text-sm text-muted-foreground">
              Get notified when something important changes.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-6 text-center text-sm text-muted-foreground">
        Rearvy AI &mdash; Built for small businesses
      </footer>
    </div>
  );
}
