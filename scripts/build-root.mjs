import { execSync } from "node:child_process";

function run(command) {
  execSync(command, { stdio: "inherit" });
}

if (process.env.WORKERS_CI) {
  run("npm run build:cloudflare");
} else {
  run("npm run build:web");
  run("npm run build:web:vercel:sync-output");
  run("npm run build:desktop:conditional");
}
