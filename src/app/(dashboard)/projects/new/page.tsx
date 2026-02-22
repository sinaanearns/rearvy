import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProjectCreationForm } from "@/components/projects/project-creation-form";

export default async function NewProjectPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: templates } = await supabase
    .from("project_templates")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New project</h1>
        <p className="text-muted-foreground">
          Choose a template or start from scratch
        </p>
      </div>
      <ProjectCreationForm templates={templates || []} />
    </div>
  );
}
