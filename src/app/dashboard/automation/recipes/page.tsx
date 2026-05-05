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
