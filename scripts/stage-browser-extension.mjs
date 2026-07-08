#!/usr/bin/env node

import path from "node:path";

import { stageBrowserExtension } from "./lib/stage-browser-extension.mjs";

const staged = stageBrowserExtension();

for (const target of staged.targets) {
  console.log(
    `Staged ${staged.file} v${staged.version} in ${path.relative(process.cwd(), target)}`
  );
}
