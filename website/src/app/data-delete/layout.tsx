import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Data Deletion Request | Rearvy",
  description:
    "Request deletion of eligible Rearvy account data and review the steps for connected provider access.",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function DataDeleteLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}
