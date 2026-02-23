"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Loader2, Rocket, Gift, PenTool, BarChart3 } from "lucide-react";
import type { ProjectTemplate } from "@/types/database";

const iconMap: Record<string, React.ElementType> = {
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data: project } = await supabase
      .from("projects")
      .insert({
        user_id: user.id,
        name: name.trim(),
        description: description.trim() || null,
        template_id: selectedTemplate,
      })
      .select("id")
      .single();

    if (project) {
      router.push(`/projects/${project.id}`);
    } else {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Template picker */}
      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((template) => {
          const Icon = iconMap[template.icon || ""] || Rocket;
          const isSelected = selectedTemplate === template.id;
          return (
            <Card
              key={template.id}
              className={`cursor-pointer transition-colors ${isSelected
                  ? "border-primary ring-2 ring-primary/20"
                  : "hover:bg-accent/50"
                }`}
              onClick={() => {
                setSelectedTemplate(isSelected ? null : template.id);
                if (!name && !isSelected) setName(template.name);
              }}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5" />
                  <CardTitle className="text-base">{template.name}</CardTitle>
                </div>
                <CardDescription className="text-xs">
                  {template.description}
                </CardDescription>
              </CardHeader>
            </Card>
          );
        })}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="name">Project name</Label>
          <Input
            id="name"
            placeholder="e.g. Holiday Campaign 2025"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="description">Description (optional)</Label>
          <Textarea
            id="description"
            placeholder="What is this project about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />
        </div>
        <Button type="submit" disabled={loading || !name.trim()}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create project
        </Button>
      </form>
    </div>
  );
}
