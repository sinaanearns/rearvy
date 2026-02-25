import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SidebarProvider } from "@/components/layout/sidebar-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: { user } } = await getUser();

  if (!user) {
    redirect("/login");
  }

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  const { data: recentChatsRaw } = await supabase
    .from("chats")
    .select("id, title, updated_at, messages!inner(id)")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(20);

  const recentChats = (recentChatsRaw ?? []).map((chat) => ({
    id: chat.id,
    title: chat.title,
    updated_at: chat.updated_at,
  }));

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  const userName = profile?.full_name ?? null;
  const userEmail = user!.email ?? null;

  return (
    <SidebarProvider>
      <DashboardShell
        userName={userName}
        userEmail={userEmail}
        recentChats={recentChats}
        projects={projects ?? []}
      >
        {children}
      </DashboardShell>
    </SidebarProvider>
  );
}
