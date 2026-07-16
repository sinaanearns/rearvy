import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { hasCredentialLikeText, redactSensitiveMemoryText } from "@/lib/sensitive-memory";

export type FileMemoryCategory =
  | "Credentials" | "People" | "Business" | "Projects" | "Calendar"
  | "Preferences" | "Notes" | "Research" | "Files" | "Unknown";

type FileMemoryInput = { userId: string; content: string; projectId?: string | null; tags?: string[] };
type FileMemoryResult = { category: FileMemoryCategory; filePath: string; created: boolean; updated: boolean };

export type FileMemoryItem = {
  id: string;
  title: string;
  relativePath: string;
  category: FileMemoryCategory;
  content: string;
  excerpt: string;
  size: number;
  createdAt: string;
  updatedAt: string;
};

const ROOT = path.resolve(process.env.MEMORY_ROOT || path.join(process.cwd(), "Memory"));
const safe = (value: string) => value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 80) || "Unknown";
const userRoot = (userId: string) => path.join(ROOT, safe(userId));

const FILES: Record<FileMemoryCategory, string> = {
  Credentials: "Credentials/Passwords.md", People: "People/Contacts.md", Business: "Business/Company.md",
  Projects: "Projects/Projects.md", Calendar: "Business/Meetings.md", Preferences: "Preferences/User.md",
  Notes: "Notes/Notes.md", Research: "Notes/Research.md", Files: "Files/Files.md", Unknown: "Notes/Notes.md",
};
const DIRS = ["Credentials", "People", "Business", "Projects", "Notes", "Preferences", "Logs", "Files"];
const STANDARD_FILES = [
  "Credentials/Passwords.md", "Credentials/Gmail.md", "Credentials/API_Keys.md", "Credentials/SSH_Keys.md",
  "People/Contacts.md", "People/Clients.md", "People/Employees.md", "Business/Company.md", "Business/Finance.md",
  "Business/Meetings.md", "Business/Invoices.md", "Notes/Ideas.md", "Notes/Todo.md", "Notes/Research.md", "Preferences/User.md",
];

export function classifyFileMemory(text: string): FileMemoryCategory {
  const value = text.toLowerCase();
  if (/password|api\s*key|secret|token|credential|ssh\s*key|otp|passcode/.test(value)) return "Credentials";
  if (/\b(phone|mobile|email|contact|client|employee|john|person)\b/.test(value)) return "People";
  if (/meeting|calendar|appointment|schedule|deadline/.test(value)) return "Calendar";
  if (/project|building|launch|milestone|startup/.test(value)) return "Projects";
  if (/prefer|timezone|language|i like|i want responses/.test(value)) return "Preferences";
  if (/research|study|competitor|paper|findings/.test(value)) return "Research";
  if (/invoice|finance|revenue|company|business|client work/.test(value)) return "Business";
  if (/file|document|folder|attachment/.test(value)) return "Files";
  return /idea|todo|note|remember|important/.test(value) ? "Notes" : "Unknown";
}

async function ensureTree(root: string) {
  await Promise.all(DIRS.map((dir) => mkdir(path.join(root, dir), { recursive: true })));
  await Promise.all(STANDARD_FILES.map(async (file) => {
    try { await readFile(path.join(root, file), "utf8"); } catch { await writeFile(path.join(root, file), `# ${path.basename(file, ".md")}\n`, "utf8"); }
  }));
  const log = path.join(root, "Logs/Memory_Changes.md");
  try { await readFile(log, "utf8"); } catch { await writeFile(log, "# Memory Changes\n", "utf8"); }
}

function targetFile(category: FileMemoryCategory, content: string) {
  const value = content.toLowerCase();
  if (category === "Credentials" && /gmail|google mail/.test(value)) return "Credentials/Gmail.md";
  if (category === "Credentials" && /api\s*key|secret|token/.test(value)) return "Credentials/API_Keys.md";
  if (category === "Credentials" && /ssh|private key/.test(value)) return "Credentials/SSH_Keys.md";
  if (category === "People" && /client/.test(value)) return "People/Clients.md";
  if (category === "People" && /employee|staff|team member/.test(value)) return "People/Employees.md";
  if (category === "Notes" && /idea/.test(value)) return "Notes/Ideas.md";
  if (category === "Notes" && /todo|to-do|task/.test(value)) return "Notes/Todo.md";
  if (category === "Business" && /invoice/.test(value)) return "Business/Invoices.md";
  if (category === "Business" && /finance|revenue|expense|payment/.test(value)) return "Business/Finance.md";
  if (category === "Calendar") return "Business/Meetings.md";
  return FILES[category];
}

function entryKey(content: string) {
  const clean = content.replace(/\s+/g, " ").trim();
  const match = clean.match(/^(?:my|our|the)?\s*([a-z0-9][a-z0-9 _-]{1,48})\s+(?:is|are|changed|updated|number|phone|email|password)/i);
  return safe((match?.[1] || clean.slice(0, 42)).trim()).replace(/_/g, " ");
}

function markdownEntry(content: string, projectId?: string | null) {
  const now = new Date().toISOString();
  const sensitive = hasCredentialLikeText(content);
  return `\n## ${entryKey(content)}\n- Information: ${sensitive ? redactSensitiveMemoryText(content) : content}\n- Last Updated: ${now}${projectId ? `\n- Project: ${safe(projectId)}` : ""}\n`;
}

async function appendChange(root: string, action: "Added" | "Updated", category: FileMemoryCategory, file: string) {
  const log = path.join(root, "Logs/Memory_Changes.md");
  await writeFile(log, `${new Date().toISOString()}\n~ ${action} ${category} memory in ${file}\n`, { flag: "a" });
}

export async function saveFileMemory(input: FileMemoryInput): Promise<FileMemoryResult> {
  const content = input.content.replace(/\s+/g, " ").trim();
  if (!content) throw new Error("Memory content is required");
  const category = classifyFileMemory(content);
  const root = userRoot(input.userId);
  await ensureTree(root);
  const relative = targetFile(category, content);
  const target = path.join(root, relative);
  let existing = "";
  try { existing = await readFile(target, "utf8"); } catch { /* create below */ }
  const heading = `## ${entryKey(content)}`;
  const entry = markdownEntry(content, input.projectId);
  const headingIndex = existing.toLowerCase().indexOf(heading.toLowerCase());
  let next = existing;
  let updated = false;
  if (headingIndex >= 0) {
    const nextHeading = existing.indexOf("\n## ", headingIndex + heading.length);
    next = existing.slice(0, headingIndex).trimEnd() + entry + (nextHeading >= 0 ? existing.slice(nextHeading) : "\n");
    updated = true;
  } else {
    next = (existing || `# ${category}\n`) + entry;
  }
  await writeFile(target, next, "utf8");
  await appendChange(root, updated ? "Updated" : "Added", category, relative);

  return { category, filePath: path.join("Memory", safe(input.userId), relative), created: !existing, updated };
}

export async function searchFileMemory(userId: string, query: string, limit = 5): Promise<string[]> {
  const root = userRoot(userId);
  const words = query.toLowerCase().split(/\W+/).filter((word) => word.length > 2);
  if (!words.length) return [];
  const files: string[] = [];
  async function walk(dir: string) {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" }); } catch { return; }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) await walk(full); else if (entry.name.endsWith(".md")) files.push(full);
    }
  }
  await walk(root);
  const ranked: { score: number; text: string }[] = [];
  for (const file of files) {
    const text = await readFile(file, "utf8");
    const score = words.reduce((sum, word) => sum + (text.toLowerCase().includes(word) ? 1 : 0), 0);
    if (score) ranked.push({ score, text: `[${path.relative(root, file)}]\n${text.slice(0, 4000)}` });
  }
  return ranked.sort((a, b) => b.score - a.score).slice(0, limit).map((item) => item.text);
}

function categoryFromRelativePath(relativePath: string): FileMemoryCategory {
  const segment = relativePath.split(/[\\/]/)[0];
  return (Object.keys(FILES) as FileMemoryCategory[]).includes(segment as FileMemoryCategory)
    ? segment as FileMemoryCategory
    : "Unknown";
}

function titleFromFileName(fileName: string) {
  return fileName
    .replace(/\.md$/i, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export async function listFileMemory(
  userId: string,
  query = "",
  limit = 200
): Promise<FileMemoryItem[]> {
  const root = userRoot(userId);
  const normalizedQuery = query.trim().toLowerCase();
  const files: string[] = [];

  async function walk(dir: string) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true, encoding: "utf8" });
    } catch {
      return;
    }

    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.name.endsWith(".md")) {
        files.push(full);
      }
    }
  }

  await walk(root);
  const items: FileMemoryItem[] = [];
  for (const file of files) {
    const [fileStats, content] = await Promise.all([stat(file), readFile(file, "utf8")]);
    const relativePath = path.relative(root, file).replaceAll(path.sep, "/");
    const title = titleFromFileName(path.basename(file));
    const searchable = `${relativePath}\n${content}`.toLowerCase();
    if (normalizedQuery && !searchable.includes(normalizedQuery)) {
      continue;
    }

    items.push({
      id: relativePath,
      title,
      relativePath,
      category: categoryFromRelativePath(relativePath),
      content,
      excerpt: content.replace(/^#.*$/gm, "").replace(/\s+/g, " ").trim().slice(0, 240),
      size: fileStats.size,
      createdAt: fileStats.birthtime.toISOString(),
      updatedAt: fileStats.mtime.toISOString(),
    });
  }

  return items
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.min(Math.max(limit, 1), 500));
}

export async function updateFileMemory(
  userId: string,
  relativePath: string,
  content: string
): Promise<FileMemoryItem> {
  const normalizedPath = relativePath.replaceAll("\\", "/").replace(/^\/+/, "");
  const segments = normalizedPath.split("/");
  if (!normalizedPath || !normalizedPath.endsWith(".md") || segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Only safe Markdown workspace files can be edited.");
  }

  const root = userRoot(userId);
  const target = path.resolve(root, ...segments);
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Workspace file path is outside the memory folder.");
  }

  const nextContent = content.trim();
  if (!nextContent) {
    throw new Error("File content is required.");
  }

  await readFile(target, "utf8");
  await writeFile(target, `${nextContent}\n`, "utf8");
  await appendChange(root, "Updated", categoryFromRelativePath(normalizedPath), normalizedPath);

  const updated = (await listFileMemory(userId)).find((item) => item.id === normalizedPath);
  if (!updated) {
    throw new Error("Updated workspace file could not be reloaded.");
  }

  return updated;
}
