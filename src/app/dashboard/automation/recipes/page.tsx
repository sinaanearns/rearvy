import Link from "next/link";
import { ArrowRight, CheckCircle2, Workflow } from "lucide-react";
import {
  ExecutiveModulePage,
  getExecutiveOsModule,
} from "@/components/executive-os/executive-os";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const RECIPES = [
  {
    title: "Browser recipe recorder",
    description:
      "Capture repeatable browser flows from a human demonstration, then promote the flow into a guarded recipe.",
    status: "beta",
    steps: [
      "Record the target domain and allowlist.",
      "Store selectors, screenshots, and action steps.",
      "Validate the recipe before marking it reusable.",
    ],
  },
  {
    title: "Python sandbox script",
    description:
      "Package a repeatable Python task with an approval state, runtime budget, and permitted data scopes.",
    status: "ready",
    steps: [
      "Bind the script to an approval policy.",
      "Set runtime and memory limits.",
      "Track run history and generated artifacts.",
    ],
  },
  {
    title: "Approval-gated publish flow",
    description:
      "Route external publishing through a deterministic review checkpoint before the final action fires.",
    status: "policy",
    steps: [
      "Collect the draft and the evidence bundle.",
      "Require a named approver for high-risk actions.",
      "Persist the approval snapshot with the run.",
    ],
  },
];

export default function AutomationRecipesPage() {
  const pageModule = getExecutiveOsModule("automation");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/70 pb-4">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">Recipe catalog</CardTitle>
              <Badge variant="outline" className="border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300">
                Recorder beta
              </Badge>
            </div>
            <CardDescription>
              Repeated browser or sandbox flows can be recorded and promoted into recipes once they are stable.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            {RECIPES.map((recipe) => (
              <div key={recipe.title} className="rounded-2xl border border-border/70 bg-background/70 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <p className="font-medium">{recipe.title}</p>
                    <p className="text-sm text-muted-foreground">{recipe.description}</p>
                  </div>
                  <Badge variant="outline" className="border-border/70 bg-muted/40 capitalize">
                    {recipe.status}
                  </Badge>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                  {recipe.steps.map((step) => (
                    <li key={step} className="flex items-start gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader className="space-y-2 border-b border-border/70 pb-4">
            <CardTitle className="text-base">Recipe design principles</CardTitle>
            <CardDescription>
              Recipes should be deterministic, tenant-scoped, and easy to validate before use.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-6 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Workflow className="h-4 w-4 text-sky-500" />
                Validation before reuse
              </div>
              <p className="mt-2">
                A recipe should not be reusable until it has been executed against the target domain or runtime with the expected evidence bundle.
              </p>
            </div>
            <div className="rounded-2xl border border-border/70 bg-background/70 p-4">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <Workflow className="h-4 w-4 text-sky-500" />
                Approval state encoded
              </div>
              <p className="mt-2">
                Draft recipes stay in draft, approved recipes can be executed, and archived recipes remain available for audit history.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 pt-2">
              <Button asChild>
                <Link href="/dashboard/automation">
                  Open automation
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/briefing">See the morning brief</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </ExecutiveModulePage>
  );
}
import Link from "next/link";
import { ArrowRight, FileText, Sparkles, Workflow } from "lucide-react";
import { ExecutiveModulePage, getExecutiveOsModule } from "@/components/executive-os/executive-os";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const recipes = [
  {
    title: "Browser recipe",
    badge: "Recorder beta",
    description:
      "Capture a repeatable browser path once, then replay it with allowlisted actions and evidence snapshots.",
    icon: Workflow,
    steps: ["Start a guided browser session.", "Record click and type actions.", "Save selectors and approval scope."],
  },
  {
    title: "Python script recipe",
    badge: "Sandbox ready",
    description:
      "Promote a tested ad hoc script into a versioned workflow with approval state and runtime limits.",
    icon: FileText,
    steps: ["Save code and version history.", "Set allowed scopes and memory limits.", "Queue runs from the registry."],
  },
  {
    title: "Approval recipe",
    badge: "Policy view",
    description:
      "Document when a task should auto-run, when it should await approval, and who can approve it.",
    icon: Sparkles,
    steps: ["Classify risk by action type.", "Assign a named approver for high-risk changes.", "Keep audit evidence attached to the run."],
  },
];

export default function AutomationRecipesPage() {
  const pageModule = getExecutiveOsModule("automation");

  return (
    <ExecutiveModulePage pageModule={pageModule}>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
              Recipe recorder
            </p>
            <h2 className="text-2xl font-semibold tracking-tight">Reusable execution patterns</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Turn one-off automation into repeatable recipes with clear guardrails.
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href="/dashboard/automation">
              <ArrowRight className="h-4 w-4" />
              Back to automation
            </Link>
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {recipes.map((recipe) => {
            const Icon = recipe.icon;

            return (
              <Card key={recipe.title} className="border-border/70 bg-card/80 shadow-sm">
                <CardHeader className="space-y-3 border-b border-border/70 pb-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted text-foreground">
                        <Icon className="h-4 w-4" />
                      </div>
                      <CardTitle className="text-base">{recipe.title}</CardTitle>
                    </div>
                    <Badge variant="outline" className="border-border/70 bg-background/70">{recipe.badge}</Badge>
                  </div>
                  <CardDescription>{recipe.description}</CardDescription>
                </CardHeader>
                <CardContent className="pt-6">
                  <ol className="space-y-2 text-sm text-muted-foreground">
                    {recipe.steps.map((step, index) => (
                      <li key={step} className="flex items-start gap-3 rounded-2xl border border-border/70 p-3">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                          {index + 1}
                        </span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </ExecutiveModulePage>
  );
}
