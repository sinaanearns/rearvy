"use strict";

import { Toaster } from "@/components/ui/sonner";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-slate-500/30">
      <main>{children}</main>
      <Toaster position="top-right" />
    </div>
  );
}
