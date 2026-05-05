import {
  AutomationRunTimeline,
  ExecutiveModulePage,
  MorningBriefCard,
  getExecutiveOsModule,
} from "@/components/executive-os/executive-os";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function BriefingPage() {
  const pageModule = getExecutiveOsModule("briefing");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <MorningBriefCard
          dateLabel="Today - Morning brief"
          timezone="Local timezone"
          summary="Overnight triage resolved the low-risk items, surfaced two follow-ups, and prepared the workday with a compact action list."
          actionsTaken={[
            "Resolved routine updates and low-risk queue items.",
            "Captured KPI deltas and attached the evidence bundle.",
            "Prepared the highest-value follow-up items for review.",
          ]}
          unresolvedRisks={[
            "A medium-risk publish request still needs approval.",
            "One meeting commitment is waiting on a confidence check.",
          ]}
          kpiDeltas={[
            { label: "Queue latency", value: "-18%" },
            { label: "Auto-resolved", value: "7 items" },
            { label: "Open risks", value: "2 items" },
          ]}
          deliveryChannels={["In-app first", "Email fallback", "Push alert when configured"]}
          status="Ready"
        />

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/70 pb-4">
            <CardTitle className="text-base">Overnight triage</CardTitle>
            <CardDescription>
              The brief should reflect what happened while the team was offline, then hand off the unresolved items.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6">
            <AutomationRunTimeline
              items={[
                {
                  title: "Scan overnight signals",
                  description: "Pull in automation results, meeting updates, and outstanding risks.",
                  status: "completed",
                  detail: "Completed before brief generation.",
                },
                {
                  title: "Resolve low-risk items",
                  description: "Apply changes that do not require a human approval gate.",
                  status: "completed",
                  detail: "Mutating actions remained within policy.",
                },
                {
                  title: "Deliver the brief",
                  description: "Bundle the morning view into the in-app brief and any fallback channel.",
                  status: "running",
                  detail: "Targeted for 8:05 AM local time.",
                },
              ]}
            />
          </CardContent>
        </Card>
      </div>
    </ExecutiveModulePage>
  );
}
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
