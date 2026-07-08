import type { Metadata } from "next";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getConfiguredAppOrigin } from "@/lib/utils/url";
import "./globals.css";

const isVercelBuild =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";
const isDesktopBuild =
  process.env.NEXT_PUBLIC_DESKTOP_BUILD === "true" && !isVercelBuild;
const googleAdSenseClient =
  process.env.NEXT_PUBLIC_GOOGLE_ADSENSE_CLIENT?.trim() ||
  "ca-pub-8353196926062457";

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

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import Footer from "@/components/layout/footer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {!isDesktopBuild && (
          <>
            <Script
              id="google-adsense"
              async
              src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${googleAdSenseClient}`}
              strategy="afterInteractive"
              crossOrigin="anonymous"
            />
            <Script
              src="https://www.googletagmanager.com/gtag/js?id=G-Z87EQGXCMH"
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', 'G-Z87EQGXCMH');
              `}
            </Script>
          </>
        )}
        <AuthProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <TooltipProvider>
              {children}
              <Toaster />
            </TooltipProvider>
            <Footer />
          </ThemeProvider>
        </AuthProvider>
        {!isDesktopBuild && (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        )}
      </body>
    </html>
  );
}
