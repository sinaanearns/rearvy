import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-expressions": "off",
      "@next/next/no-html-link-for-pages": "warn",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/refs": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/exhaustive-deps": "off",
      "react-hooks/immutability": "warn",
      "prefer-const": "warn",
    },
  },
  {
    files: ["**/*.cjs", "create-release.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "website/.next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local runtime and virtual env artifacts.
    ".browser-use-runtime/**",
    ".mcpjam/**",
    ".mempalace-runtime/**",
    "website/.mempalace-runtime/**",
    ".venv/**",
    "automaton/**",
    "desktop-app/.generated/**",
    "desktop-release/**",
    "desktop-release-alt/**",
    "desktop-release-updated/**",
    "release/**",
    "scratch/**",
    "public/downloads/*.exe",
    "public/downloads/*.blockmap",
    "public/downloads/latest.json",
    "website/public/downloads/*.exe",
    "website/public/downloads/*.blockmap",
    "scripts/browser-use/.venv/**",
  ]),
]);

export default eslintConfig;
