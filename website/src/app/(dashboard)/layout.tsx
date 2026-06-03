import type { Metadata } from "next";

import { DashboardClientLayout } from "./dashboard-client-layout";

export const metadata: Metadata = {
  title: "Rearvy Workspace",
  description: "Authenticated Rearvy workspace routes for signed-in users.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DashboardClientLayout>{children}</DashboardClientLayout>;
}
