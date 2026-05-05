import {
  ApprovalPanel,
  ArtifactPreviewCard,
  ExecutiveModulePage,
  getExecutiveOsModule,
} from "@/components/executive-os/executive-os";

export default function AssetsPage() {
  const pageModule = getExecutiveOsModule("assets");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="grid gap-4 md:grid-cols-2">
          <ArtifactPreviewCard
            title="Campaign social pack"
            subtitle="Variant-ready copy and visual prompts for a social launch"
            lineage="Shopify store, recent KPI deltas, and campaign brief"
            status="draft"
            details={[
              "A/B variants prepared for approval",
              "Captions can be localized per channel",
              "Evidence bundle includes prompt inputs",
            ]}
          />
          <ArtifactPreviewCard
            title="Board deck page"
            subtitle="A single presentation-ready page summarizing the weekly executive view"
            lineage="KPI trends, key risks, and delivery status"
            status="review"
            details={[
              "Layout locks down once approved",
              "Metrics trace back to live source data",
              "Designed for investor and board review",
            ]}
          />
          <ArtifactPreviewCard
            title="Ad variant set"
            subtitle="Multiple ad variants generated from a single campaign prompt"
            lineage="Audience profile, offer, and creative angle"
            status="approved"
            details={[
              "Publishable after final sign-off",
              "Each variant is tagged with lineage",
              "Outputs are ready for platform-specific export",
            ]}
          />
          <ArtifactPreviewCard
            title="Brand-safe preview"
            subtitle="Preview asset tuned for the brand system and content guardrails"
            lineage="Brand voice, tone rules, and approval matrix"
            status="stable"
            details={[
              "Follows the approved visual system",
              "Text constraints are embedded in the prompt",
              "Designed to reduce review churn",
            ]}
          />
        </div>

        <ApprovalPanel
          title="Publish policy"
          riskLevel="medium"
          state="Publishing external creative should stay in awaiting approval until the final reviewer signs off."
          policy="Assets are stored with lineage so the team can trace where every preview came from, what prompt generated it, and who approved it for release."
          bullets={[
            "Cloud Storage holds the artifact payloads and previews.",
            "Approval is required before external publication.",
            "Lineage links source data, prompt inputs, and outputs.",
          ]}
        />
      </div>
    </ExecutiveModulePage>
  );
}
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
