import {
  ApprovalPanel,
  ArtifactPreviewCard,
  ExecutiveModulePage,
  getExecutiveOsModule,
} from "@/components/executive-os/executive-os";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PIPELINE = [
  "Capture investor notes and contact context.",
  "Generate an update draft from the latest metrics.",
  "Assemble board packet pages from approved sources.",
  "Persist the packet for review and handoff.",
];

export default function InvestorPage() {
  const pageModule = getExecutiveOsModule("investor");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/70 pb-4">
            <CardTitle className="text-base">Fundraising pipeline</CardTitle>
            <CardDescription>
              Investor work stays lightweight: updates, packets, and relationship context live in one workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Workflow</p>
              <ul className="mt-3 space-y-2">
                {PIPELINE.map((step, index) => (
                  <li key={step} className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border border-border/70 text-[10px] font-semibold text-foreground">
                      {index + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
            <ArtifactPreviewCard
              title="Investor update"
              subtitle="A concise update draft for the current investor list"
              lineage="Revenue, product milestones, and open risks"
              status="draft"
              details={[
                "Drafted from approved metrics only",
                "Can be revised before sending",
                "Prepared for a controlled external update",
              ]}
            />
            <ArtifactPreviewCard
              title="Board packet"
              subtitle="A more detailed packet for board review"
              lineage="Financials, milestones, hiring, and risk register"
              status="review"
              details={[
                "Separated from the external update channel",
                "Optimized for deep review rather than brevity",
                "Every page tracks back to a source reference",
              ]}
            />
          </CardContent>
        </Card>

        <ApprovalPanel
          title="Investor boundary"
          riskLevel="high"
          state="External investor communication and finance-adjacent changes should stay in an approval state until a named policy allows release."
          policy="The investor workspace is a command center, not a replacement for legal, finance, or cap table systems. It should keep compliance boundaries explicit in the UI."
          bullets={[
            "Track whom each update is intended for.",
            "Keep the packet lineage visible and auditable.",
            "Require explicit approval before anything is sent externally.",
          ]}
        />
      </div>
    </ExecutiveModulePage>
  );
}
import { ExecutiveModulePage, getExecutiveOsModule, ArtifactPreviewCard, ApprovalPanel } from "@/components/executive-os/executive-os";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const investorSections = [
  {
    title: "Investor updates",
    description:
      "Drafted updates should pull from approved metrics, recent wins, and any open risks that need to be surfaced.",
  },
  {
    title: "Board packets",
    description:
      "Board packets should bundle the operating snapshot, KPI deltas, and strategic requests into one approved packet.",
  },
  {
    title: "Fundraising pipeline",
    description:
      "Keep the stage, next touch, and last note attached to each investor record for follow-up clarity.",
  },
];

export default function InvestorPage() {
  const pageModule = getExecutiveOsModule("investor");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Investor OS
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Update and board packet workspace</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This area keeps investor-facing work lightweight, auditable, and separated from the legal system of record.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {investorSections.map((section) => (
            <Card key={section.title} className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="text-base">{section.title}</CardTitle>
                <CardDescription>{section.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                Structured notes, approvals, and source references stay attached to the workspace.
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <ArtifactPreviewCard
            title="Board packet draft"
            subtitle="Snapshot of metrics, progress, and requests"
            lineage="Metrics feed -> narrative summary -> packet draft"
            status="Draft"
            details={[
              "Generated from approved inputs only",
              "Approval required before distribution",
              "Packet history remains available for audit",
            ]}
          />

          <ApprovalPanel
            title="Compliance boundary"
            riskLevel="high"
            state="Investor-facing content remains approval-first until legal boundaries are defined."
            policy="The module should never become a cap table system replacement or send external updates without an explicit approval path."
            bullets={[
              "Keep distribution gated until the recipient list is confirmed.",
              "Record each packet version and the approver that released it.",
              "Separate drafting from final send permissions.",
            ]}
          />
        </div>
      </section>
    </ExecutiveModulePage>
  );
}
