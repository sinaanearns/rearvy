import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  ApprovalPanel,
  ArtifactPreviewCard,
  ExecutiveModulePage,
  getExecutiveOsModule,
} from "@/components/executive-os/executive-os";
import { Button } from "@/components/ui/button";

const artifactPreviews = [
  {
    title: "Social post set",
    subtitle: "Three variants for distribution testing",
    lineage: "Campaign brief -> copy draft -> preview render",
    status: "Ready for review",
    details: ["Versioned copy and assets", "Approval before publish", "Stored previews for audit"],
  },
  {
    title: "Board deck section",
    subtitle: "Operating snapshot for investor updates",
    lineage: "KPI delta -> narrative summary -> deck page",
    status: "Draft",
    details: ["Pulled from approved metrics", "Link back to source data", "Designed for board review"],
  },
  {
    title: "Ad variant pack",
    subtitle: "Creative refresh with tracked lineage",
    lineage: "Prompt input -> generated variants -> publish candidate",
    status: "Awaiting approval",
    details: ["Variants kept side by side", "Publish blocked until approval", "Lineage included in artifact metadata"],
  },
];

export default function AssetsPage() {
  const pageModule = getExecutiveOsModule("assets");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Asset studio
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Campaign and board-ready outputs</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Every artifact is previewable, versioned, and traceable back to its source inputs.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/automation">
              <ArrowRight className="h-4 w-4" />
              Review automation
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            {artifactPreviews.map((artifact) => (
              <ArtifactPreviewCard key={artifact.title} {...artifact} />
            ))}
          </div>
          <ApprovalPanel
            title="Publish gate"
            riskLevel="medium"
            state="Media and external content should wait for approval before going live."
            policy="Asset generation can be fully automated for draft creation, but publishing should remain explicit until the policy editor is live."
            bullets={[
              "Keep preview images and metadata stored with the artifact.",
              "Record whether the artifact was draft, approved, or published.",
              "Attach the source prompt and any input documents to lineage.",
            ]}
          />
        </div>
      </section>
    </ExecutiveModulePage>
  );
}
