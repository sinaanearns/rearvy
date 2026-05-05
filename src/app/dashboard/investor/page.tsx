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
