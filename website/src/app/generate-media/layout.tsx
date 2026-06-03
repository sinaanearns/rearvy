import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generate Media | Rearvy",
  description: "Generate and edit media inside the authenticated Rearvy workspace.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function GenerateMediaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
