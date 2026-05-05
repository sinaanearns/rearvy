import {
  ApprovalPanel,
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

const COMMITMENTS = [
  "Ship the new landing page copy by Wednesday.",
  "Send the updated investor deck before the board packet deadline.",
  "Review the approval threshold for the next automation run.",
];

export default function MeetingsPage() {
  const pageModule = getExecutiveOsModule("meetings");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/70 pb-4">
            <CardTitle className="text-base">Transcript ingestion</CardTitle>
            <CardDescription>
              Meeting runs begin with an uploaded transcript, participant list, and confidence scores for extracted commitments.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Pipeline</p>
              <ol className="mt-3 space-y-3">
                <li>1. Ingest transcript and meeting metadata.</li>
                <li>2. Extract commitments and unresolved questions.</li>
                <li>3. Apply updates to the business pulse summary.</li>
                <li>4. Persist the meeting run for audit and replay.</li>
              </ol>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Extracted commitments</p>
              <ul className="mt-3 space-y-2">
                {COMMITMENTS.map((commitment) => (
                  <li key={commitment} className="rounded-lg border border-border/70 px-3 py-2">
                    {commitment}
                  </li>
                ))}
              </ul>
            </div>
          </CardContent>
        </Card>

        <ApprovalPanel
          title="Commitment confidence gate"
          riskLevel="medium"
          state="Low-confidence commitments should be surfaced for review before they become actionable updates."
          policy="Extraction should only auto-apply when the meeting confidence is high enough and the update is low risk. Everything else stays in review."
          bullets={[
            "Transcript confidence and participant identity should be recorded.",
            "Follow-up updates should only apply after the gate passes.",
            "The run should keep the original transcript reference intact.",
          ]}
        />
      </div>
    </ExecutiveModulePage>
  );
}
import { ExecutiveModulePage, getExecutiveOsModule, MorningBriefCard } from "@/components/executive-os/executive-os";
import { ApprovalPanel } from "@/components/executive-os/executive-os";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const commitmentExamples = [
  {
    title: "Follow up on scope change",
    description: "Confirm the revised scope by Friday and update the project owner.",
  },
  {
    title: "Publish the recap",
    description: "Share the meeting recap and the next-step timeline with stakeholders.",
  },
  {
    title: "Update CRM notes",
    description: "Push the key commitments back into the account record.",
  },
];

export default function MeetingsPage() {
  const pageModule = getExecutiveOsModule("meetings");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
            Meeting intelligence
          </p>
          <h2 className="text-2xl font-semibold tracking-tight">Transcript to commitment pipeline</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            The output of each meeting should be a structured list of commitments, owners, and confidence.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="border-b border-border/70">
              <CardTitle className="text-base">Commitment extraction</CardTitle>
              <CardDescription>
                Extracted items should stay reviewable before they are applied to downstream systems.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 pt-6">
              {commitmentExamples.map((item, index) => (
                <div key={item.title} className="rounded-2xl border border-border/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium text-foreground">{item.title}</p>
                    <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      Commitment {index + 1}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-4">
            <ApprovalPanel
              title="Confidence threshold"
              riskLevel="low"
              state="Meeting updates should only auto-apply when confidence is high enough."
              policy="Apply updates to business pulse or CRM only after the extractor is confident and the mapping is unambiguous."
              bullets={[
                "Keep the transcript reference attached to the meeting record.",
                "Store the confidence score with each extracted commitment.",
                "Fallback to a review step if the mapping is ambiguous.",
              ]}
            />

            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="border-b border-border/70">
                <CardTitle className="text-base">Meeting run output</CardTitle>
                <CardDescription>
                  What gets written back after a meeting is processed.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6 text-sm text-muted-foreground">
                <ul className="space-y-2">
                  <li>Transcript reference and summary</li>
                  <li>Extracted commitments with owners</li>
                  <li>Applied updates and unresolved risks</li>
                  <li>Confidence score and follow-up notes</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section>
        <MorningBriefCard
          dateLabel="Today\'s meeting digest"
          timezone="UTC"
          status="Ready for review"
          summary="Three commitments were extracted from the latest meeting, one follow-up item is still pending, and the CRM update step is waiting for confirmation."
          actionsTaken={[
            "Captured the transcript and speaker roster.",
            "Extracted the primary commitments and owners.",
            "Queued the downstream update step for review.",
          ]}
          unresolvedRisks={[
            "One action item lacks a clear owner.",
            "A follow-up deliverable needs a better due date.",
          ]}
          kpiDeltas={[
            { label: "Commitments", value: "3 extracted" },
            { label: "Confidence", value: "0.84" },
            { label: "Applied updates", value: "1 pending" },
          ]}
          deliveryChannels={["In-app digest", "Slack summary", "Email fallback"]}
        />
      </section>
    </ExecutiveModulePage>
  );
}
