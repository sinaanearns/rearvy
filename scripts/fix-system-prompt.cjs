"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "lib", "ai", "system-prompt.ts");
let content = fs.readFileSync(target, "utf8");

const lines = content.split("\n");
const targetLine = "``  const systemPromptWithProfileMemory = `${profileMemoryRules}\\n\\n`;";
const idx = lines.findIndex((line) => line === targetLine);
if (idx === -1) {
  console.log("Could not find malformed profile memory line");
  process.exit(0);
}

const replacement = "  const systemPromptWithProfileMemory = " + String.fromCharCode(96) + "${profileMemoryRules}" + String.fromCharCode(92) + "n" + String.fromCharCode(92) + "n" + String.fromCharCode(96) + ";";
lines[idx] = replacement;

fs.writeFileSync(target, lines.join("\n"));
console.log("Fixed profile memory line");
