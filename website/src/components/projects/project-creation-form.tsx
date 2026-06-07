"use client";

import type { ElementType, FormEvent } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Gift,
  Layers3,
  Loader2,
  PenTool,
  Rocket,
  Sparkles,
} from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClientLogger } from "@/lib/client-diagnostics";
import { cn } from "@/lib/utils";
import type { ProjectTemplate } from "@/types/database";

const log = createClientLogger("ProjectCreationForm");

const iconMap: Record<string, ElementType> = {
  rocket: Rocket,
  gift: Gift,
  "pen-tool": PenTool,
  "bar-chart-3": BarChart3,
};

const categoryLabels: Record<ProjectTemplate["category"], string> = {
  launch: "Launch",
  campaign: "Campaign",
  strategy: "Strategy",
  analysis: "Analysis",
  custom: "Custom",
};

const workflowCues = [
  {
    label: "Template",
    detail: "Pick a repeatable pattern or start clean.",
    icon: Layers3,
  },
  {
    label: "Brief",
    detail: "Name the client goal and operating context.",
    icon: ClipboardList,
  },
  {
    label: "Workspace",
    detail: "Open with chats, research, and next actions grouped.",
    icon: Rocket,
  },
];

interface ProjectCreationFormProps {
  templates: ProjectTemplate[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function readProjectCreateResponse(response: Response) {
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload)) {
    return {};
  }

  return {
    error: typeof payload.error === "string" ? payload.error : undefined,
    id:
      typeof payload.id === "string" && payload.id.trim()
        ? payload.id.trim()
        : undefined,
  };
}

export function ProjectCreationForm({ templates }: ProjectCreationFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { user } = useAuth();
  const selectedTemplateDetails =
    templates.find((template) => template.id === selectedTemplate) ?? null;
  const workspaceNamePreview =
    name.trim() || selectedTemplateDetails?.name || "Untitled client workspace";
  const workspaceDescriptionPreview =
    description.trim() ||
    selectedTemplateDetails?.description ||
    "Add a short client goal, campaign, or review scope before creating.";

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (!user) {
      setError("Sign in before creating a workspace.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const token = await user.getIdToken();
      const response = await fetch("/api/dashboard/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
          template_id: selectedTemplate,
        }),
      });

      const data = await readProjectCreateResponse(response);
      if (!response.ok) {
        throw new Error(data.error || "Failed to create project");
      }

      if (!data.id) {
        throw new Error("Project creation response did not include an id");
      }

      router.push(`/projects/${encodeURIComponent(data.id)}`);
    } catch (error) {
      log.error("Error creating project:", error);
      setError(
        error instanceof Error ? error.message : "Failed to create workspace."
      );
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(360px,0.72fr)]">
      <section className="space-y-3">
        <div className="rounded-[8px] border border-border/70 bg-card/[0.88] p-4 shadow-sm shadow-slate-950/[0.03] dark:bg-slate-950/[0.72]">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(320px,1fr)] lg:items-end">
            <div>
              <p className="text-xs font-medium text-muted-foreground">
                Operating template
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight">
                Choose a repeatable client workflow
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Templates give the workspace an operating shape without locking the
                team into a rigid process.
              </p>
            </div>

            <div className="grid gap-2 sm:grid-cols-3">
              {workflowCues.map((cue) => {
                const Icon = cue.icon;

                return (
                  <div
                    key={cue.label}
                    className="rounded-[8px] border border-border/70 bg-background/[0.72] p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.055]"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10 text-cyan-600 dark:text-cyan-100">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="truncate text-sm font-semibold">{cue.label}</p>
                    </div>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      {cue.detail}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {templates.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => {
              const Icon = iconMap[template.icon || ""] || Rocket;
              const isSelected = selectedTemplate === template.id;
              return (
                <button
                  type="button"
                  key={template.id}
                  aria-pressed={isSelected}
                  className={cn(
                    "group relative min-h-[176px] overflow-hidden rounded-[8px] border border-border/70 bg-card/[0.86] p-4 text-left shadow-sm shadow-slate-950/[0.03] transition hover:-translate-y-0.5 hover:border-cyan-200/45 hover:shadow-md dark:bg-slate-950/[0.72]",
                    isSelected
                      ? "border-cyan-300 bg-cyan-50/70 ring-2 ring-cyan-200/35 dark:bg-cyan-300/[0.08]"
                      : ""
                  )}
                  onClick={() => {
                    setSelectedTemplate(isSelected ? null : template.id);
                    if (!name && !isSelected) setName(template.name);
                  }}
                >
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/55 to-transparent opacity-0 transition-opacity group-hover:opacity-100"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(105,215,255,0.12),transparent_44%),linear-gradient(225deg,rgba(247,201,72,0.1),transparent_42%)] opacity-0 transition-opacity group-hover:opacity-100"
                  />

                  <div className="relative flex h-full flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <span className="flex h-11 w-11 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10 text-cyan-600 shadow-sm dark:text-cyan-100">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-xs font-semibold",
                          isSelected
                            ? "border-cyan-300/60 bg-cyan-100 text-cyan-800 dark:border-cyan-200/30 dark:bg-cyan-200/12 dark:text-cyan-100"
                            : "border-border/70 bg-background/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.06]"
                        )}
                      >
                        {isSelected ? (
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null}
                        {isSelected ? "Selected" : categoryLabels[template.category]}
                      </span>
                    </div>

                    <div className="mt-4 min-w-0">
                      <h3 className="text-base font-semibold leading-6 text-foreground">
                        {template.name}
                      </h3>
                      <p className="mt-2 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {template.description}
                      </p>
                    </div>

                    <div className="mt-auto grid grid-cols-2 gap-2 pt-4">
                      <div className="rounded-[8px] border border-border/60 bg-background/[0.66] px-3 py-2 dark:border-white/10 dark:bg-white/[0.045]">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Tools
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {template.default_tools.length || "Clean"}
                        </p>
                      </div>
                      <div className="rounded-[8px] border border-border/60 bg-background/[0.66] px-3 py-2 dark:border-white/10 dark:bg-white/[0.045]">
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Prompts
                        </p>
                        <p className="mt-1 text-sm font-semibold">
                          {template.starter_prompts.length || "Manual"}
                        </p>
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="relative overflow-hidden rounded-[8px] border border-dashed border-border/80 bg-card/[0.72] p-6 shadow-sm dark:bg-slate-950/[0.72]">
            <div aria-hidden className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/50 to-transparent" />
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[8px] border border-amber-200/40 bg-amber-200/10 text-amber-600 dark:text-amber-100">
                <Rocket className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-base font-semibold">Start from a clean workspace</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  No templates are available right now. Create the workspace and add
                  client context, chats, research, and next actions as the work grows.
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      <Card className="relative overflow-hidden rounded-[8px] border-border/70 bg-card/[0.9] shadow-sm shadow-slate-950/[0.03] dark:bg-slate-950/[0.78]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/55 to-transparent"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(145deg,rgba(247,201,72,0.1),transparent_42%),linear-gradient(315deg,rgba(105,215,255,0.1),transparent_38%)]"
        />
        <CardHeader className="relative border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-amber-200/35 bg-amber-200/10 text-amber-600 dark:text-amber-100">
                <Sparkles className="h-5 w-5" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <CardTitle className="text-base">Workspace details</CardTitle>
                <CardDescription>
                  Give the client workspace a name your team can scan.
                </CardDescription>
              </div>
            </div>
            <span className="hidden rounded-[8px] border border-border/70 bg-background/70 px-2.5 py-1 text-xs font-semibold text-muted-foreground dark:border-white/10 dark:bg-white/[0.06] sm:inline-flex">
              {selectedTemplateDetails ? "Template ready" : "Clean start"}
            </span>
          </div>
        </CardHeader>
        <CardContent className="relative p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="rounded-[8px] border border-border/70 bg-background/[0.74] p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.055]">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Workspace preview
                </p>
                <span className="rounded-[8px] border border-cyan-200/30 bg-cyan-200/10 px-2.5 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-100">
                  {selectedTemplateDetails
                    ? categoryLabels[selectedTemplateDetails.category]
                    : "Custom"}
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-lg font-semibold leading-6">
                {workspaceNamePreview}
              </p>
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">
                {workspaceDescriptionPreview}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Workspace name</Label>
              <Input
                id="name"
                placeholder="e.g. Acme Skin - Weekly Growth Review"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-11 rounded-[8px] bg-background/80"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe the client, goal, or review workflow this workspace is for."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-28 rounded-[8px] bg-background/80"
                rows={3}
              />
            </div>
            <div className="grid gap-3 rounded-[8px] border border-border/70 bg-background/[0.62] p-3 text-sm dark:border-white/10 dark:bg-white/[0.045]">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Template</span>
                <span className="truncate font-medium">
                  {selectedTemplateDetails?.name || "No template selected"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground">Name</span>
                <span
                  className={cn(
                    "font-medium",
                    name.trim()
                      ? "text-foreground"
                      : "text-amber-600 dark:text-amber-100"
                  )}
                >
                  {name.trim() ? "Ready" : "Required"}
                </span>
              </div>
            </div>
            <Button
              type="submit"
              disabled={loading || !name.trim()}
              className="h-11 w-full justify-between rounded-[8px] px-4"
            >
              <span className="inline-flex items-center gap-2">
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Rocket className="h-4 w-4" />
                )}
                Create workspace
              </span>
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            </Button>
            {error ? (
              <p
                className="rounded-[8px] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-300/25 dark:bg-red-300/10 dark:text-red-100"
                role="alert"
              >
                {error}
              </p>
            ) : null}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
