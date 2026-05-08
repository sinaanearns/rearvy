import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import path from "node:path";

const websiteRoot = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(websiteRoot, "..");

const nextConfig: NextConfig = {
  output: "standalone",
  // Use repository root so Vercel's Turbopack can resolve `next` when
  // the project directory is inferred from `/website/src/app`.
  outputFileTracingRoot: repoRoot,
  experimental: {
    esmExternals: true,
  },
  turbopack: {
    root: repoRoot,
  },
  webpack(config) {
    return config;
  },
  serverExternalPackages: ["firebase-admin", "xlsx"],
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
