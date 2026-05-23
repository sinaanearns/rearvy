import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopDir = path.join(rootDir, "desktop-app");
const sourceDir = path.resolve(process.env.REARVY_AUTOMATON_DIR || path.join(rootDir, "automaton"));
const outputDir = path.join(desktopDir, ".generated", "automaton");

function commandName(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const useWindowsCmdWrapper = process.platform === "win32" && /\.cmd$/i.test(command);
    const quoteWindowsArg = (value) => {
      const text = String(value);
      if (!/[\s"^&|<>]/.test(text)) {
        return text;
      }

      return `"${text.replaceAll('"', '\\"')}"`;
    };
    const wrappedCommand = [command, ...args].map(quoteWindowsArg).join(" ");
    const child = spawn(
      useWindowsCmdWrapper ? "cmd.exe" : command,
      useWindowsCmdWrapper ? ["/d", "/s", "/c", wrappedCommand] : args,
      {
        cwd: options.cwd || rootDir,
        env: options.env || process.env,
        shell: false,
        stdio: "inherit",
        windowsHide: false,
      }
    );

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

function assertAutomatonSource() {
  const requiredPaths = [
    "package.json",
    "pnpm-lock.yaml",
    "scripts/rearvy-runner.js",
    "dist/index.js",
  ];

  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `Automaton source not found at ${sourceDir}. Set REARVY_AUTOMATON_DIR or check out/build automaton at ${path.join(
        rootDir,
        "automaton"
      )}.`
    );
  }

  for (const relativePath of requiredPaths) {
    const fullPath = path.join(sourceDir, relativePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error(
        `Automaton runtime is missing ${relativePath} at ${fullPath}. Run "cd automaton && npm run build".`
      );
    }
  }
}

function copyRuntimeFiles() {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });

  for (const directory of ["dist", "scripts"]) {
    fs.cpSync(path.join(sourceDir, directory), path.join(outputDir, directory), {
      recursive: true,
      force: true,
    });
  }

  for (const file of ["package.json", "pnpm-lock.yaml", "constitution.md"]) {
    const sourcePath = path.join(sourceDir, file);
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, path.join(outputDir, file));
    }
  }
}

console.log(`Preparing Automaton runtime from ${sourceDir}`);
assertAutomatonSource();
copyRuntimeFiles();

console.log(`Installing Automaton production dependencies in ${outputDir}`);
await run(commandName("pnpm"), [
  "install",
  "--prod",
  "--frozen-lockfile",
  "--config.ignore-workspace=true",
  "--dir",
  outputDir,
]);

console.log(`Prepared Automaton runtime at ${outputDir}`);
