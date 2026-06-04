import { InsightsList } from "@/components/insights/insights-list";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
import { Activity, Database, Globe2, Sparkles } from "lucide-react";

export default function InsightsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 animate-in fade-in duration-500">
      <DashboardPageHero
        eyebrow="Signal map"
        title="Insight command center"
        description="Turn connected client data into market signals, risks, opportunities, and work-ready recommendations."
        icon={Sparkles}
        accent="emerald"
        metrics={[
          { label: "Data sources", value: "Connect", icon: Database },
          { label: "Live signals", value: "Ready", icon: Activity },
          { label: "Market view", value: "Global", icon: Globe2 },
        ]}
      />

      <section className="overflow-hidden rounded-[8px] border border-border/70 bg-card/85 p-4 shadow-sm shadow-slate-950/[0.03] dark:border-white/10 dark:bg-white/[0.04] sm:p-6">
        <InsightsList />
      </section>
    </div>
  );
}
