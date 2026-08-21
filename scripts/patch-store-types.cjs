"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "lib", "profile-memory", "store.ts");
let content = fs.readFileSync(target, "utf8");

const oldSnap = [
  "export type ProfileMemorySnapshot = {",
  "  entries: ProfileMemoryFact[];",
  "  updated_at: string;",
  '  source: "desktop_scan" | "user_statement" | "profile_form" | "merge";',
  "};",
].join("\n");
const newSnap = [
  "export type ProfileMemorySnapshot = {",
  "  entries: ProfileMemoryFact[];",
  "  updated_at: string;",
  '  source: "desktop_scan" | "user_statement" | "profile_form" | "merge";',
  "};",
  "",
  "export type PersistProfileMemoryInput = {",
  "  adminDb: Firestore;",
  "  userId: string;",
  "  entries: ProfileMemoryEntry[];",
  "  source?: ProfileMemoryDoc[\"source\"];",
  "};",
  "",
  "export type MirrorProfileMemoryInput = {",
  "  adminDb: Firestore;",
  "  userId: string;",
  "  projectId?: string | null;",
  "  snapshot: ProfileMemoryFact[];",
  "};",
].join("\n");

if (!content.includes("export type PersistProfileMemoryInput")) {
  if (content.includes(oldSnap)) {
    content = content.replace(oldSnap, newSnap);
    console.log("Added helper input types");
  }
}

fs.writeFileSync(target, content);
console.log("Wrote profile-memory/store.ts");
