import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  turbopack: {
    root: process.cwd(),
  },
  serverExternalPackages: ["playwright", "playwright-core", "firebase-admin", "xlsx"],
  experimental: {
    outputFileTracingExcludes: {
      "*": [
        "node_modules/@playwright/browser-chromium",
        "node_modules/@playwright/browser-firefox",
        "node_modules/@playwright/browser-webkit",
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
      ],
    },
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
