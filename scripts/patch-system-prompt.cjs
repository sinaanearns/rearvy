"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "lib", "ai", "system-prompt.ts");
let content = fs.readFileSync(target, "utf8");

const lines = content.split("\n");
const idx = lines.findIndex((line) => line.startsWith("  return") && line.includes("You are Rearvy"));
if (idx === -1) {
  console.log("Deep mode return not found");
} else if (content.includes("systemPromptWithProfileMemory")) {
  console.log("systemPromptWithProfileMemory already present");
} else {
  const helper = "  const systemPromptWithProfileMemory = `${profileMemoryRules}\\n\\n";
  lines.splice(idx, 0, helper);
  const target = lines[idx + 1];
  if (target) {
    lines[idx + 1] = target.replace("return `You are Rearvy", "return systemPromptWithProfileMemory + `You are Rearvy");
  }
  content = lines.join("\n");
  console.log("Prepended profileMemoryRules to deep mode return");
}

fs.writeFileSync(target, content);
console.log("Wrote system-prompt.ts");
