import type { Metadata } from "next";

import { DemoClientLayout } from "./demo-client-layout";

export const metadata: Metadata = {
  title: "Rearvy Demo",
  description: "Rearvy product demo routes with sample data and preview workflows.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DemoClientLayout>{children}</DemoClientLayout>;
}
