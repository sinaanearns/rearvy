import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    esmExternals: true,
  },
  turbopack: {
    root: process.cwd(/*turbopackIgnore: true*/),
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
};

export default nextConfig;
