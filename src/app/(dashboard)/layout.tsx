import { createClient, getUser } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

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

  return (
    <div className="min-h-screen">
      <Sidebar />
      <div className="md:pl-60">
        <Topbar userName={profile?.full_name} />
        <main className="p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
