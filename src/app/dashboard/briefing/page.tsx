import { ExecutiveModulePage, getExecutiveOsModule, MorningBriefCard } from "@/components/executive-os/executive-os";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const briefingActions = [
  "No critical blocker was escalated overnight.",
  "One medium-risk task still awaits approval.",
  "Two repeated actions were converted into reusable recipes.",
];

export default function BriefingPage() {
  const pageModule = getExecutiveOsModule("briefing");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Morning briefing
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Daily triage before the workday starts</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The brief should summarize what was resolved overnight, what still needs attention, and what changed.
          </p>
        </div>

        <MorningBriefCard
          dateLabel="Today\'s briefing"
          timezone="Local time"
          status="Delivered"
          summary="The overnight automation queue finished three low-risk actions, one approval is still outstanding, and the main KPI movement is a small revenue uptick with stable support volume."
          actionsTaken={briefingActions}
          unresolvedRisks={[
            "One campaign publish step is still blocked by approval.",
            "A follow-up note should be added to the investor workspace.",
          ]}
          kpiDeltas={[
            { label: "Revenue", value: "+2.4%" },
            { label: "Support tickets", value: "Flat" },
            { label: "Resolved overnight", value: "3 actions" },
          ]}
          deliveryChannels={["In-app brief", "Email test", "Slack fallback"]}
        />

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="border-b border-border/70">
            <CardTitle className="text-base">Briefing history</CardTitle>
            <CardDescription>
              Keep the last few days of briefs available for a quick operating review.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 text-sm text-muted-foreground">
            The next milestone is automated overnight recovery and a tested delivery fallback path.
          </CardContent>
        </Card>
      </section>
    </ExecutiveModulePage>
  );
}
