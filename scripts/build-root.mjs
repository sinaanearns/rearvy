import { spawnSync } from "node:child_process";

function getNpmInvocation() {
  if (process.env.npm_execpath) {
    return {
      command: process.execPath,
      argsPrefix: [process.env.npm_execpath],
    };
  }

  return {
    command: process.platform === "win32" ? "npm.cmd" : "npm",
    argsPrefix: [],
  };
}

function runScript(scriptName) {
  const npm = getNpmInvocation();
  const result = spawnSync(npm.command, [...npm.argsPrefix, "run", scriptName], {
    stdio: "inherit",
    shell: true,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(`npm run ${scriptName} exited with code ${result.status}`);
  }
}

if (process.env.WORKERS_CI) {
  runScript("build:cloudflare");
} else {
  runScript("build:web");
  runScript("build:web:vercel:sync-output");
  runScript("build:desktop:conditional");
}
