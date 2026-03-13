"use strict";

import { redirect } from "next/navigation";
import { isAdminAuthenticated } from "@/lib/admin-auth";
import { Toaster } from "@/components/ui/sonner";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 font-sans">
      <main>{children}</main>
      <Toaster />
    </div>
  );
}
