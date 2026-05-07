import { FolderKanban, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ProjectsPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Client workspaces</h1>
          <p className="text-muted-foreground">
            Organize each client, campaign, or strategic initiative in one workspace
          </p>
        </div>
        <Link href="/projects/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            New workspace
          </Button>
        </Link>
      </div>

      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
        <FolderKanban className="h-10 w-10 text-muted-foreground/50" />
        <h3 className="mt-4 font-medium">No workspaces yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Create your first client workspace to keep related chats and context together
        </p>
        <Link href="/projects/new" className="mt-4">
          <Button variant="outline" size="sm">
            Create workspace
          </Button>
        </Link>
      </div>
    </div>
  );
}
