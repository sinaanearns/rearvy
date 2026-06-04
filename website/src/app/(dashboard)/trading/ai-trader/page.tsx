import { AITraderDashboard } from "@/components/trading/ai-trader-dashboard";

export default function AITraderPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-in fade-in duration-500">
      <div className="rounded-[8px] border bg-card/85 p-1 shadow-sm shadow-slate-950/[0.03]">
        <div className="rounded-[8px] bg-card p-6 md:p-8">
          <AITraderDashboard />
        </div>
      </div>
    </div>
  );
}
