"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import { ProjectCreationForm } from "@/components/projects/project-creation-form";
import { useAuth } from "@/components/auth-provider";
import { createClientLogger } from "@/lib/client-diagnostics";
import { getErrorMessage } from "@/lib/error-utils";
import type { ProjectTemplate } from "@/types/database";

const log = createClientLogger("NewProjectPage");

const TEMPLATE_CATEGORIES = new Set<ProjectTemplate["category"]>([
  "launch",
  "campaign",
  "strategy",
  "analysis",
  "custom",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function getStarterPrompts(value: unknown): ProjectTemplate["starter_prompts"] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (!isRecord(item) || typeof item.label !== "string" || typeof item.prompt !== "string") {
      return [];
    }

    return [{
      label: item.label,
      prompt: item.prompt,
    }];
  });
}

function getTemplate(value: unknown): ProjectTemplate | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") {
    return null;
  }

  const category = typeof value.category === "string" && TEMPLATE_CATEGORIES.has(value.category as ProjectTemplate["category"])
    ? value.category as ProjectTemplate["category"]
    : "custom";

  return {
    id: value.id,
    slug: typeof value.slug === "string" && value.slug.trim() ? value.slug : value.id,
    name: value.name,
    description: typeof value.description === "string" ? value.description : null,
    category,
    icon: typeof value.icon === "string" ? value.icon : null,
    starter_prompts: getStarterPrompts(value.starter_prompts),
    default_tools: getStringArray(value.default_tools),
    system_prompt_addon: typeof value.system_prompt_addon === "string" ? value.system_prompt_addon : null,
    is_active: value.is_active === true,
    created_at: typeof value.created_at === "string" ? value.created_at : "",
  };
}

async function readTemplatesResponse(response: Response): Promise<ProjectTemplate[]> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload) || !Array.isArray(payload.templates)) {
    return [];
  }

  return payload.templates
    .map(getTemplate)
    .filter((template): template is ProjectTemplate => Boolean(template));
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (isRecord(payload) && typeof payload.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

export default function NewProjectPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadTemplates() {
      try {
        const response = await fetch("/api/dashboard/templates");
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, "Failed to fetch templates"));
        }

        const templates = await readTemplatesResponse(response);
        if (!cancelled) {
          setTemplates(templates);
          setTemplateError(null);
        }
      } catch (error) {
        if (!cancelled) {
          log.error("Error loading templates:", error);
          setTemplates([]);
          setTemplateError(getErrorMessage(error, "Unable to load workspace templates."));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTemplates();

    return () => {
      cancelled = true;
    };
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

      {templateError ? (
        <div className="flex items-start gap-3 rounded-[8px] border border-amber-300/40 bg-amber-100/40 px-4 py-3 text-sm text-amber-900 dark:border-amber-300/20 dark:bg-amber-300/10 dark:text-amber-100">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Templates could not be loaded</p>
            <p className="mt-1 opacity-80">{templateError}</p>
          </div>
        </div>
      ) : null}

      <ProjectCreationForm templates={templates} />
    </div>
  );
}
