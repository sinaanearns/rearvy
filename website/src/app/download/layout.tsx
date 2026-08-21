import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Install Rearvy",
  description:
    "Install the Rearvy web app, download the browser relay extension package, or get the Rearvy desktop app for Windows and macOS.",
};

export default function DownloadLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
