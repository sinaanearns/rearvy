import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Maria Listener | Rearvy",
  description: "Rearvy Desktop voice listener bridge for Maria.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function MariaListenerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
