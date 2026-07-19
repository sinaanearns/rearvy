import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getConfiguredAppOrigin } from "@/lib/utils/url";
import "./globals.css";


const isVercelBuild =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";
const isDesktopBuild =
  process.env.NEXT_PUBLIC_DESKTOP_BUILD === "true" && !isVercelBuild;

function getMetadataBase() {
  return new URL(getConfiguredAppOrigin());
}

const faviconIco = {
  url: "/favicon.ico",
  type: "image/x-icon",
  sizes: "16x16 24x24 32x32 48x48 64x64 128x128 256x256",
};

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  applicationName: "Rearvy",
  manifest: "/site.webmanifest",
  title: "Rearvy - AI Business Assistant",
  description:
    "Rearvy is an AI business assistant for connected data, research, writing, approvals, and execution in one focused workspace.",
  icons: {
    icon: [
      faviconIco,
      { url: "/favicon.png", type: "image/png", sizes: "256x256" },
    ],
    shortcut: [faviconIco],
    apple: [
      {
        url: "/apple-touch-icon.png",
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
  openGraph: {
    siteName: "Rearvy",
    images: [
      {
        url: "/rearvy-social.png",
        width: 1200,
        height: 800,
        alt: "Rearvy",
      },
    ],
  },
  verification: {
    google: "EOQTHzLDnF2zdboZ7pjbs-ToigEzAzdqDBaZw42K0u8",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-[#050706] text-white antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <TooltipProvider>
              {children}
              <Toaster position="top-right" richColors />
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
