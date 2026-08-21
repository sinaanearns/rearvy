"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "components", "work", "work-platform.tsx");
let content = fs.readFileSync(target, "utf8");

const marker =
  "{activeView === \"overview\" ? (\n        <div className=\"space-y-5\">\n        <div className=\"mt-5\">\n          <ProfileMemoryCard />\n        </div>\n\n          <div className=\"grid gap-3 sm:grid-cols-2\">";
const replacement =
  "{activeView === \"overview\" ? (\n        <div className=\"space-y-5\">\n          <ProfileMemoryCard />\n\n          <div className=\"grid gap-3 sm:grid-cols-2\">";

if (content.includes(marker)) {
  content = content.replace(marker, replacement);
  console.log("Moved ProfileMemoryCard into overview summary row");
} else {
  console.log("ProfileMemoryCard already placed in overview summary row");
}

fs.writeFileSync(target, content);
console.log("Wrote work-platform.tsx");
