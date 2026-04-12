import { InsightsList } from "@/components/insights/insights-list";
import { Sparkles } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2 text-primary">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-semibold tracking-wider uppercase">Live Trading</span>
        </div>
        <h1 className="text-4xl font-extrabold tracking-tight">Live Trade Insights</h1>
        <p className="text-lg text-muted-foreground max-w-2xl">
          Real-time ranked trade opportunities with estimated profit per trade from current market data only.
        </p>
      </div>

      <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl border p-1">
        <div className="bg-card rounded-[calc(var(--radius)-4px)] p-6 md:p-8">
          <InsightsList />
        </div>
      </div>
    </div>
  );
}
