"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "app", "api", "chat", "route.ts");
let content = fs.readFileSync(target, "utf8");

const oldCall = "    context: promptContext,\r\n    webResearchMode: includeWebTools";
if (!content.includes(oldCall)) {
  console.log("baseSystemPrompt call signature not found");
} else if (content.includes("profileMemoryBlock: formatProfileMemoryBlock")) {
  console.log("Already wired profileMemoryBlock");
} else {
  const replacement =
    "    context: promptContext,\r\n    profileMemoryBlock: formatProfileMemoryBlock(promptContext.profileMemory),\r\n    webResearchMode: includeWebTools";
  content = content.replace(oldCall, replacement);
  console.log("Wired profileMemoryBlock into buildSystemPrompt call");
}

if (!content.includes("function formatProfileMemoryBlock")) {
  const helper = [
    "function formatProfileMemoryBlock(snapshot) {",
    "  const entries = Array.isArray(snapshot?.entries) ? snapshot.entries : [];",
    "  if (entries.length === 0) return \"\";",
    "  const lines = entries.map((entry) => `- ${entry.label || entry.slot}: ${entry.value}`);",
    "  return [",
    '    "DEVICE & SOFTWARE PROFILE (already saved to memory; do not re-ask unless the user updates it):",',
    "    ...lines,",
    '  ].join("\\n");',
    "}",
    "",
  ].join("\n");
  const target_marker = "function desktopWorkflowInputToRecord(";
  if (content.includes(target_marker)) {
    content = content.replace(target_marker, helper + "function desktopWorkflowInputToRecord(");
    console.log("Inserted formatProfileMemoryBlock helper");
  }
}

fs.writeFileSync(target, content);
console.log("Wrote chat/route.ts");
