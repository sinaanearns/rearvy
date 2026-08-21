"use strict";
const fs = require("node:fs");
const path = require("node:path");

const target = path.resolve(process.cwd(), "website", "src", "lib", "ai", "tools", "update-profile.ts");
let content = fs.readFileSync(target, "utf8");

// Bail out cleanly when the model passes a malformed/empty payload.
const oldGuard = "  try {\n    const userId = ctx.userId;\n    if (!userId) {\n      throw new Error('User ID is required');\n    }";
const newGuard = [
  "  try {",
  "    const userId = ctx.userId;",
  "    if (!userId) {",
  "      throw new Error('User ID is required');",
  "    }",
  "    if (!input || typeof input !== \"object\") {",
  "      log.warn(\"updateProfile called without a valid input payload\");",
  "      return { success: false };",
  "    }",
].join("\n");
if (!content.includes("if (!input || typeof input !== \"object\")")) {
  if (content.includes(oldGuard)) {
    content = content.replace(oldGuard, newGuard);
    console.log("Added early-bail guard for empty/malformed input");
  }
}

fs.writeFileSync(target, content);
console.log("Wrote update-profile.ts");
