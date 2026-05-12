import { AITraderDashboard } from "@/components/trading/ai-trader-dashboard";

export default function AITraderPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="bg-gradient-to-br from-card to-muted/20 rounded-2xl border p-1">
        <div className="bg-card rounded-[calc(var(--radius)-4px)] p-6 md:p-8">
          <AITraderDashboard />
        </div>
      </div>
    </div>
  );
}
