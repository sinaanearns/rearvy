import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(websiteRoot, "..");
const isVercelBuild =
  process.env.VERCEL === "1" || process.env.VERCEL === "true";
const isDesktopBuild =
  process.env.NEXT_PUBLIC_DESKTOP_BUILD === "true" && !isVercelBuild;
const isCloudflareBuild = process.env.OPEN_NEXT_BUILD === "true";
const buildRoot = isCloudflareBuild ? websiteRoot : repoRoot;

const nextConfig: NextConfig = {
  devIndicators: false,
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
  ],
  output: isDesktopBuild || isCloudflareBuild ? "standalone" : undefined,
  experimental: {
    esmExternals: true,
  },
  productionBrowserSourceMaps: false,
  outputFileTracingRoot: buildRoot,
  turbopack: {
    root: buildRoot,
  },
  serverExternalPackages: ["firebase-admin", "xlsx"],
  async headers() {
    if (isDesktopBuild) {
      return [];
    }

    const isDev = process.env.NODE_ENV === "development";
    const unsafeEval = isDev ? "'unsafe-eval' " : "";
    const connectSrc = ["'self'", "https:", "wss:"];

    if (isDev) {
      connectSrc.push("http://127.0.0.1:*", "http://localhost:*", "ws://127.0.0.1:*", "ws://localhost:*");
    }

    const cspValue = `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' blob: ${unsafeEval}https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com https://apis.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src ${connectSrc.join(" ")}; worker-src 'self' blob:; frame-src 'self' https://accounts.google.com https://www.google.com https://*.firebaseapp.com https://*.firebase.google.com; upgrade-insecure-requests`;
    return [
      {
        source: "/downloads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store",
          },
        ],
      },
      {
        source: "/data-delete",
        headers: [
          {
            key: "X-Robots-Tag",
            value: "noindex, nofollow",
          },
        ],
      },
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspValue,
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
        ],
      },
    ];
  },
  async redirects() {
    if (isDesktopBuild) {
      return [];
    }

    const electronUserAgent = {
      type: "header" as const,
      key: "user-agent",
      value: ".*Electron.*",
    };
    const blockedDesktopPaths = [
      "/",
      "/home",
      "/403",
      "/blog/:path*",
      "/contact/:path*",
      "/download/:path*",
      "/demo/:path*",
      "/privacy/:path*",
      "/terms/:path*",
      "/privacy-policy/:path*",
      "/security/:path*",
      "/report-issue/:path*",
      "/data-delete/:path*",
    ];

    return blockedDesktopPaths.map((source) => ({
      source,
      destination: "/login",
      permanent: false,
      has: [electronUserAgent],
    }));
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "static-files.saasbrowser.com",
      },
      {
        protocol: "https",
        hostname: "api.producthunt.com",
      },
    ],
  },
  outputFileTracingExcludes: {
    "*": [
      "next.config.ts",
      ".agents",
      ".claude",
      ".codebuddy",
      ".commandcode",
      ".continue",
      ".crush",
      ".factory",
      ".goose",
      ".junie",
      ".kilocode",
      ".kiro",
      ".kode",
      ".mcpjam",
      ".mempalace-runtime",
      ".mux",
      ".neovate",
      ".openhands",
      ".pi",
      ".pochi",
      ".qoder",
      ".qwen",
      ".roo",
      ".trae",
      ".windsurf",
      ".zencoder",
      "desktop-release",
      "desktop-release/**",
      "public/chat-attachments",
      "public/chat-attachments/**",
      "public/downloads",
      "public/downloads/**",
      "website/public/chat-attachments",
      "website/public/chat-attachments/**",
      "website/public/downloads",
      "website/public/downloads/**",
      "release",
    ],
  },
  outputFileTracingIncludes: {
    "*": [
      "node_modules/jose/dist/browser/**/*",
      "node_modules/jsonwebtoken/node_modules/semver/**/*",
    ],
  },
  async rewrites() {
    if (isDesktopBuild) {
      return [];
    }

    return [
      {
        source: "/__/auth/:path*",
        destination: "https://rearvy-74c50.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
