import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Download Rearvy Desktop",
  description:
    "Download the Rearvy desktop app for Windows and open your connected agency workspace from a native app.",
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
