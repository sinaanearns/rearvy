import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
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

function getMetadataBase() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.rearvy.com";

  try {
    return new URL(appUrl);
  } catch {
    return new URL("https://www.rearvy.com");
  }
}

export const metadata: Metadata = {
  metadataBase: getMetadataBase(),
  title: "Rearvy - AI Business Execution Platform",
  description:
    "Rearvy turns business data into sales outreach, content, follow-ups, and revenue-driving actions with AI agents that execute on your behalf.",
  icons: {
    icon: "/favicon.png?v=20260523a",
    shortcut: "/favicon.png?v=20260523a",
    apple: "/apple-touch-icon.png?v=20260523a",
  },
  openGraph: {
    images: ["/rearvy-social.png?v=20260523a"],
  },
  verification: {
    google: "EOQTHzLDnF2zdboZ7pjbs-ToigEzAzdqDBaZw42K0u8",
  },
};

import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";

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
