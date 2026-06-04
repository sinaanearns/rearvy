"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderKanban, LayoutTemplate, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { DashboardPageHero } from "@/components/dashboard/dashboard-page-hero";
import { ProjectCreationForm } from "@/components/projects/project-creation-form";
import { useAuth } from "@/components/auth-provider";
import type { ProjectTemplate } from "@/types/database";

export default function NewProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTemplates() {
      try {
        const response = await fetch("/api/dashboard/templates");
        if (!response.ok) throw new Error("Failed to fetch templates");
        const data = await response.json();
        setTemplates(data.templates || []);
      } catch (error) {
        console.error("Error loading templates:", error);
      } finally {
        setLoading(false);
      }
    }

    loadTemplates();
  }, []);

  if (authLoading || loading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    router.push("/login");
    return null;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-10">
      <Link href="/projects" className="inline-flex items-center text-sm font-medium text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="mr-2 h-4 w-4" />
        Back to client workspaces
      </Link>

      <DashboardPageHero
        eyebrow="New client workspace"
        title="Build the workspace before the work starts."
        description="Pick a reusable operating template or start clean, then group the client brief, research, chats, and next actions under one workspace."
        icon={FolderKanban}
        accent="amber"
        metrics={[
          { label: "Templates", value: templates.length, detail: "available patterns", icon: LayoutTemplate },
          { label: "Scope", value: "Client", detail: "campaign or initiative", icon: FolderKanban },
          { label: "Output", value: "Review", detail: "briefs and decisions", icon: Sparkles },
        ]}
      />

      <ProjectCreationForm templates={templates} />
    </div>
  );
}
