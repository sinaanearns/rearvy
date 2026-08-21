import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access Denied | Rearvy",
  description: "Access denied status page for protected Rearvy routes.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForbiddenLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
