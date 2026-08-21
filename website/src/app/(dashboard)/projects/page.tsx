import { ArrowRight, FolderKanban, Plus, Sparkles, Users, Workflow } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <DashboardPageHero
        eyebrow="Client workspaces"
        title="Client workspaces"
        description="Keep each client, campaign, or strategic initiative in one place with its own chats, context, and decision trail."
        icon={FolderKanban}
        accent="amber"
        metrics={[
          { label: "Workspace", value: "Client scoped", detail: "Chats and context", icon: FolderKanban },
          { label: "Team handoff", value: "Review ready", detail: "Briefs and next actions", icon: Users },
          { label: "Workflow", value: "Repeatable", detail: "Campaign operations", icon: Workflow },
        ]}
        actions={
          <Button asChild className="rounded-[8px]">
            <Link href="/projects/new">
              New workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="relative overflow-hidden rounded-[8px] border border-dashed border-border/80 bg-card/[0.72] px-5 py-16 text-center shadow-sm">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(247,201,72,0.13),transparent_42%)]"
        />
        <div className="relative mx-auto flex h-16 w-16 items-center justify-center rounded-[8px] border border-amber-200/35 bg-amber-200/10">
          <Sparkles className="h-8 w-8 text-amber-600 dark:text-amber-100" />
        </div>
        <h3 className="relative mt-5 text-lg font-semibold">No workspaces yet</h3>
        <p className="relative mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
          Create your first client workspace to keep related chats, research, campaign plans, and context together.
        </p>
        <Button asChild variant="outline" size="sm" className="relative mt-5 rounded-[8px]">
          <Link href="/projects/new">
            Create workspace
            <Plus className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
