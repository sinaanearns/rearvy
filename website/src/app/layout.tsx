import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DesktopApiInterceptor from "@/components/DesktopApiInterceptor";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
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

export const metadata: Metadata = {
  title: "Rearvy - AI Workspace for Growth Agencies",
  description:
    "Rearvy helps growth agencies connect client data, spot what changed, and walk into review calls with a clear next action.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
  verification: {
    google: "EOQTHzLDnF2zdboZ7pjbs-ToigEzAzdqDBaZw42K0u8",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { Suspense } from "react";

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
              <Suspense fallback={null}>
                <DesktopApiInterceptor />
              </Suspense>
              {children}
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </AuthProvider>
        {process.env.NODE_ENV === "development" && (
          <Script id="rearvy-launch-desktop" strategy="afterInteractive">
            {`(function(){try{var h=location.hostname; if(h==='localhost' || h==='127.0.0.1'){fetch('/api/desktop').catch(()=>{});} }catch(e){} })();`}
          </Script>
        )}
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
