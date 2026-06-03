import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Desktop Sign-In | Rearvy",
  description: "Complete Rearvy Desktop sign-in from an authenticated browser session.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DesktopAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
