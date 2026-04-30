import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features | Rearvy",
  description:
    "See how Rearvy helps growth agencies connect client data, generate weekly briefs, and surface the next action.",
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
