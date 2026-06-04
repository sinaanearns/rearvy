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
import { BarChart3, CheckCircle2, Gift, Loader2, PenTool, Rocket, Sparkles } from "lucide-react";
import { useAuth } from "@/components/auth-provider";
import { createClientLogger } from "@/lib/client-diagnostics";
import type { ProjectTemplate } from "@/types/database";

const log = createClientLogger("ProjectCreationForm");

const iconMap: Record<string, ElementType> = {
  rocket: Rocket,
  gift: Gift,
  "pen-tool": PenTool,
  "bar-chart-3": BarChart3,
};

interface ProjectCreationFormProps {
  templates: ProjectTemplate[];
}

export function ProjectCreationForm({ templates }: ProjectCreationFormProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user } = useAuth();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim() || !user) return;
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
          name: name.trim(),
          description: description.trim() || null,
          template_id: selectedTemplate,
        }),
      });

      if (!response.ok) throw new Error("Failed to create project");

      const data = (await response.json()) as { id?: unknown };
      if (typeof data.id !== "string") {
        throw new Error("Project creation response did not include an id");
      }

      router.push(`/projects/${data.id}`);
    } catch (error) {
      log.error("Error creating project:", error);
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,0.88fr)_minmax(360px,0.72fr)]">
      <section className="space-y-3">
        <div>
          <p className="text-xs font-medium text-muted-foreground">
            Operating template
          </p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight">
            Choose a repeatable client workflow
          </h2>
        </div>

        {templates.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {templates.map((template) => {
              const Icon = iconMap[template.icon || ""] || Rocket;
              const isSelected = selectedTemplate === template.id;
              return (
                <Card
                  key={template.id}
                  className={`cursor-pointer overflow-hidden rounded-[8px] border-border/70 bg-card/[0.88] shadow-sm transition hover:border-cyan-200/45 hover:shadow-md ${
                    isSelected
                      ? "border-cyan-300 ring-2 ring-cyan-200/35"
                      : ""
                  }`}
                  onClick={() => {
                    setSelectedTemplate(isSelected ? null : template.id);
                    if (!name && !isSelected) setName(template.name);
                  }}
                >
                  <CardHeader className="space-y-3 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-cyan-200/35 bg-cyan-200/10 text-cyan-600 dark:text-cyan-100">
                        <Icon className="h-5 w-5" />
                      </div>
                      {isSelected ? (
                        <CheckCircle2 className="h-4 w-4 text-cyan-600 dark:text-cyan-100" />
                      ) : null}
                    </div>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-3 text-xs leading-5">
                        {template.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[8px] border border-dashed border-border/80 bg-card/[0.72] p-6 text-sm leading-6 text-muted-foreground">
            No templates are available right now. Start from scratch and add client context as the workspace grows.
          </div>
        )}
      </section>

      <Card className="overflow-hidden rounded-[8px] border-border/70 bg-card/[0.88] shadow-sm shadow-slate-950/[0.03]">
        <CardHeader className="border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-amber-200/35 bg-amber-200/10 text-amber-600 dark:text-amber-100">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Workspace details</CardTitle>
              <CardDescription>Give the client workspace a name your team can scan.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-5">
          <form onSubmit={handleSubmit} className="space-y-4">
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
            <Button type="submit" disabled={loading || !name.trim()} className="w-full rounded-[8px] sm:w-auto">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create workspace
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
