import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maria Overlay | Rearvy",
  description: "Rearvy Desktop voice overlay for Maria.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MariaOverlayLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
