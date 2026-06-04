import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Features | Rearvy",
  description:
    "See how Rearvy works as an AI business assistant for connected data, briefs, research, approvals, and next actions.",
};

export default function FeaturesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
