import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(websiteRoot, "..");

const nextConfig: NextConfig = {
  experimental: {
    esmExternals: true,
  },
  productionBrowserSourceMaps: false,
  turbopack: {
    root: repoRoot,
  },
  serverExternalPackages: ["firebase-admin", "xlsx"],
  async headers() {
    const isDev = process.env.NODE_ENV === "development";
    const unsafeEval = isDev ? "'unsafe-eval' " : "";
    const cspValue = `default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self'; script-src 'self' 'unsafe-inline' ${unsafeEval}https://www.googletagmanager.com https://www.google-analytics.com https://va.vercel-scripts.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https:; font-src 'self' data:; connect-src 'self' https: wss:; frame-src 'self' https://accounts.google.com https://www.google.com; upgrade-insecure-requests`;
    return [
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
      "release",
    ],
  },
  async rewrites() {
    return [
      {
        source: "/__/auth/:path*",
        destination: "https://rearvy-74c50.firebaseapp.com/__/auth/:path*",
      },
    ];
  },
};

export default nextConfig;
