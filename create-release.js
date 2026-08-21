#!/usr/bin/env node
const { execFileSync } = require("node:child_process");

execFileSync(process.execPath, ["scripts/create-github-release.mjs"], {
  stdio: "inherit",
});
