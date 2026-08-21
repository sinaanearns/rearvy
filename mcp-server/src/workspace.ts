import { access, readFile, readdir, realpath, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SOURCE_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_WORKSPACE_ROOT = path.resolve(SOURCE_DIRECTORY, "../..");
const MAX_FILE_BYTES = 512 * 1024;
const MAX_RETURNED_CHARACTERS = 48_000;
const MAX_SEARCHED_FILES = 800;
const MAX_DIRECTORY_DEPTH = 12;

const EXCLUDED_DIRECTORY_NAMES = new Set([
  ".git",
  ".next",
  ".turbo",
  ".vercel",
  "node_modules",
  "dist",
  "build",
  "coverage",
  "desktop-release",
]);

const TEXT_EXTENSIONS = new Set([
  ".cjs",
  ".css",
  ".html",
  ".ini",
  ".js",
  ".json",
  ".md",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".toml",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);

function isWithinRoot(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function isSensitivePath(relativePath: string): boolean {
  const normalized = relativePath.replaceAll("\\", "/").toLowerCase();
  const basename = path.posix.basename(normalized);

  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename.includes("credential") ||
    basename.includes("secret") ||
    basename.includes("service-account") ||
    normalized.includes("/.ssh/") ||
    normalized.includes("/private/")
  );
}

function isTextPath(relativePath: string): boolean {
  return TEXT_EXTENSIONS.has(path.extname(relativePath).toLowerCase());
}

export async function getWorkspaceRoot(): Promise<string> {
  const configuredRoot = process.env.REARVY_WORKSPACE_ROOT?.trim();
  const candidate = path.resolve(configuredRoot || DEFAULT_WORKSPACE_ROOT);

  try {
    await access(candidate, fsConstants.R_OK);
    return await realpath(candidate);
  } catch {
    throw new Error("Rearvy workspace root is unavailable or unreadable.");
  }
}

export async function resolveWorkspacePath(relativePath: string): Promise<{ root: string; absolutePath: string; relativePath: string }> {
  if (!relativePath || path.isAbsolute(relativePath)) {
    throw new Error("Provide a non-empty path relative to the Rearvy workspace.");
  }

  const root = await getWorkspaceRoot();
  const absolutePath = path.resolve(root, relativePath);
  if (!isWithinRoot(root, absolutePath)) {
    throw new Error("The requested path is outside the Rearvy workspace.");
  }

  const canonicalRelativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
  if (isSensitivePath(canonicalRelativePath)) {
    throw new Error("The requested path is protected and cannot be exposed through the MCP server.");
  }

  return { root, absolutePath, relativePath: canonicalRelativePath };
}

export async function readWorkspaceTextFile(relativePath: string, startLine = 1, maxLines = 250) {
  const target = await resolveWorkspacePath(relativePath);
  if (!isTextPath(target.relativePath)) {
    throw new Error("Only approved text and source file types can be read through the MCP server.");
  }

  const metadata = await stat(target.absolutePath);
  if (!metadata.isFile()) {
    throw new Error("The requested path is not a file.");
  }
  if (metadata.size > MAX_FILE_BYTES) {
    throw new Error("The requested file is too large to expose through the MCP server.");
  }

  const normalizedStartLine = Math.max(1, Math.floor(startLine));
  const normalizedMaxLines = Math.min(500, Math.max(1, Math.floor(maxLines)));
  const lines = (await readFile(target.absolutePath, "utf8")).split(/\r?\n/);
  const selectedLines = lines.slice(normalizedStartLine - 1, normalizedStartLine - 1 + normalizedMaxLines);

  return {
    path: target.relativePath,
    startLine: normalizedStartLine,
    endLine: normalizedStartLine + selectedLines.length - 1,
    totalLines: lines.length,
    text: selectedLines.join("\n").slice(0, MAX_RETURNED_CHARACTERS),
  };
}

type SearchMatch = {
  path: string;
  line: number;
  snippet: string;
};

async function collectSearchableFiles(root: string, startDirectory: string): Promise<string[]> {
  const files: string[] = [];

  async function visit(directory: string, depth: number): Promise<void> {
    if (files.length >= MAX_SEARCHED_FILES || depth > MAX_DIRECTORY_DEPTH) {
      return;
    }

    const entries = await readdir(directory, { withFileTypes: true });
    const fileEntries = entries.filter((entry) => entry.isFile());
    const directoryEntries = entries.filter((entry) => entry.isDirectory());

    for (const entry of fileEntries) {
      if (files.length >= MAX_SEARCHED_FILES) {
        return;
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      if (isTextPath(relativePath) && !isSensitivePath(relativePath)) {
        files.push(absolutePath);
      }
    }

    for (const entry of directoryEntries) {
      if (files.length >= MAX_SEARCHED_FILES) {
        return;
      }

      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      if (!EXCLUDED_DIRECTORY_NAMES.has(entry.name) && !isSensitivePath(relativePath)) {
        await visit(absolutePath, depth + 1);
      }
    }
  }

  await visit(startDirectory, 0);
  return files;
}

export async function searchWorkspace(query: string, pathPrefix = "", maxResults = 20): Promise<SearchMatch[]> {
  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2 || normalizedQuery.length > 200) {
    throw new Error("Search queries must contain between 2 and 200 characters.");
  }

  const root = await getWorkspaceRoot();
  const startDirectory = path.resolve(root, pathPrefix || ".");
  if (!isWithinRoot(root, startDirectory)) {
    throw new Error("The requested search path is outside the Rearvy workspace.");
  }

  const prefix = path.relative(root, startDirectory).replaceAll("\\", "/");
  if (isSensitivePath(prefix)) {
    throw new Error("The requested search path is protected.");
  }

  const resultLimit = Math.min(50, Math.max(1, Math.floor(maxResults)));
  const files = await collectSearchableFiles(root, startDirectory);
  const needle = normalizedQuery.toLocaleLowerCase();
  const matches: SearchMatch[] = [];

  for (const absolutePath of files) {
    if (matches.length >= resultLimit) {
      break;
    }

    let metadata;
    try {
      metadata = await stat(absolutePath);
    } catch {
      continue;
    }
    if (metadata.size > MAX_FILE_BYTES) {
      continue;
    }

    let text: string;
    try {
      text = await readFile(absolutePath, "utf8");
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length && matches.length < resultLimit; index += 1) {
      if (lines[index].toLocaleLowerCase().includes(needle)) {
        matches.push({
          path: path.relative(root, absolutePath).replaceAll("\\", "/"),
          line: index + 1,
          snippet: lines[index].trim().slice(0, 360),
        });
      }
    }
  }

  return matches;
}

export async function getWorkspaceOverview() {
  const root = await getWorkspaceRoot();
  const packageJson = await readWorkspaceTextFile("package.json", 1, 200);
  let packageMetadata: { name?: unknown; version?: unknown; description?: unknown } = {};
  try {
    packageMetadata = JSON.parse(packageJson.text) as { name?: unknown; version?: unknown; description?: unknown };
  } catch {
    // The package file is readable but malformed; the overview remains useful.
  }

  const knownComponents = ["website", "desktop-app", "mcp-server", "scripts", "docs"];
  const components = [] as string[];
  for (const component of knownComponents) {
    try {
      const componentStats = await stat(path.join(root, component));
      if (componentStats.isDirectory()) {
        components.push(component);
      }
    } catch {
      // Optional component is not present in this checkout.
    }
  }

  return {
    name: typeof packageMetadata.name === "string" ? packageMetadata.name : "rearvy2.0",
    version: typeof packageMetadata.version === "string" ? packageMetadata.version : null,
    description: typeof packageMetadata.description === "string" ? packageMetadata.description : null,
    components,
    access: {
      mode: "read-only",
      excluded: ["environment files", "credentials", "secrets", "private directories", "build output"],
      desktopControl: "not exposed; use Rearvy approval-gated workflows inside the desktop app",
    },
  };
}
