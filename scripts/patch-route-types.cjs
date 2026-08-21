"use strict";
const fs = require("node:fs");
const path = require("node:path");

function patch(targetPath, lines) {
  let content = fs.readFileSync(targetPath, "utf8");
  for (const { oldText, newText, label } of lines) {
    if (!content.includes(oldText)) {
      console.log(`Skip (not found in ${path.basename(targetPath)}): ${label}`);
      continue;
    }
    if (content.includes(newText.split("\n")[0]) && oldText.includes(newText.split("\n")[0])) {
      console.log(`Skip (already present in ${path.basename(targetPath)}): ${label}`);
      continue;
    }
    content = content.replace(oldText, newText);
    console.log(`Patched ${path.basename(targetPath)}: ${label}`);
  }
  fs.writeFileSync(targetPath, content);
}

const desktop = path.resolve(process.cwd(), "website", "src", "app", "api", "desktop", "profile-memory", "route.ts");
patch(desktop, [
  {
    label: "cast snapshot entries (desktop)",
    oldText: "snapshot: { entries: persisted.entries as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: \"desktop_scan\" },",
    newText: "snapshot: { entries: persisted.entries as unknown as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: \"desktop_scan\" },",
  },
]);

const profile = path.resolve(process.cwd(), "website", "src", "app", "api", "profile", "memory", "route.ts");
patch(profile, [
  {
    label: "cast snapshot entries (profile)",
    oldText: "snapshot: { entries: persisted.entries as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: \"merge\" },",
    newText: "snapshot: { entries: persisted.entries as unknown as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: \"merge\" },",
  },
]);

const card = path.resolve(process.cwd(), "website", "src", "components", "work", "profile-memory-card.tsx");
patch(card, [
  {
    label: "profile memory type guard",
    oldText: "  const profileMemoryEntries = profileMemory?.entries ?? [];\n  const profileMemoryBlock = profileMemoryEntries.length\n    ? `\\n${profileMemoryBlock}\\n`\n    : \"\";",
    newText: "  const profileMemoryEntries = (profileMemory?.entries ?? []) as Array<{ slot?: string; label?: string; value?: string }>;",
  },
]);
