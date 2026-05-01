import type { NextConfig } from "next";
import path from "node:path";

const isVercel = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    esmExternals: true,
  },
  turbopack: {
    root: process.cwd(/*turbopackIgnore: true*/),
    ...(isVercel
      ? {
          resolveAlias: {
            playwright: "./src/lib/live-browser/playwright-noop.js",
          },
        }
      : {}),
  },
  webpack(config) {
    if (isVercel) {
      config.resolve.alias = {
        ...config.resolve.alias,
        playwright: path.join(
          process.cwd(/*turbopackIgnore: true*/),
          "src/lib/live-browser/playwright-noop.js"
        ),
      };
    }
    return config;
  },
  serverExternalPackages: ["firebase-admin", "xlsx"],
  outputFileTracingExcludes: {
    "*": [
      ".agents",
      ".browser-use-runtime",
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
      "desktop",
      "desktop-release",
      "release",
      "public/downloads/*.exe",
      "scripts/**/*",
      "**/*.md",
      "**/*.log",
      "node_modules/.cache/**/*",
      ".git/**/*",
      ".github/**/*",
      ".vscode/**/*",
      ".venv/**/*",
      "next.config.ts",
      // Only exclude heavy browser automation dependencies on Vercel (website)
      ...(isVercel
        ? [
            "node_modules/@playwright/browser-chromium",
            "node_modules/@playwright/browser-firefox",
            "node_modules/@playwright/browser-webkit",
            "node_modules/@playwright/browser-chromium/**/*",
            "node_modules/@playwright/browser-firefox/**/*",
            "node_modules/@playwright/browser-webkit/**/*",
            "node_modules/playwright/**/*",
            "node_modules/playwright-core/**/*",
            "node_modules/xlsx/**/*",
          ]
        : []),
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
  images: {
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
};

export default nextConfig;
