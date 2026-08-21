"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "app", "api", "desktop", "profile-memory", "route.ts");
let content = fs.readFileSync(target, "utf8");

const oldRoute = [
  "    return NextResponse.json({",
  "      snapshot: { entries: persisted.entries, updated_at: persisted.updated_at, source: \"desktop_scan\" },",
  "      added: persisted.added,",
  "      upgraded: persisted.upgraded,",
  "      mirrored,",
  "    });",
].join("\n");
const newRoute = [
  "    return NextResponse.json({",
  "      snapshot: { entries: persisted.entries as ProfileMemoryEntry[], updated_at: persisted.updated_at, source: \"desktop_scan\" },",
  "      added: persisted.added,",
  "      upgraded: persisted.upgraded,",
  "      mirrored,",
  "    });",
].join("\n");
if (!content.includes(newRoute)) {
  if (content.includes(oldRoute)) {
    content = content.replace(oldRoute, newRoute);
    console.log("Cast desktop snapshot to ProfileMemoryEntry[]");
  }
}

if (!content.includes("import type { ProfileMemoryEntry }")) {
  content = `import type { ProfileMemoryEntry } from \"@/lib/profile-memory/types\";\n` + content;
  console.log("Added ProfileMemoryEntry import to desktop route");
}

fs.writeFileSync(target, content);
console.log("Wrote desktop route");
