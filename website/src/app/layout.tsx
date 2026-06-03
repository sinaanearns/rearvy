import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { getConfiguredAppOrigin } from "@/lib/utils/url";
import "./globals.css";

const isDesktopBuild = process.env.NEXT_PUBLIC_DESKTOP_BUILD === "true";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  title: "Rearvy - AI Workspace for Getting Work Done",
  description:
    "Rearvy brings research, planning, writing, automation, and execution into one focused AI workspace.",
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
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {!isDesktopBuild && (
          <>
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
