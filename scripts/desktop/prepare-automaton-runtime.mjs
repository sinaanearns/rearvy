import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const desktopDir = path.join(rootDir, "desktop-app");
const sourceDir = path.resolve(process.env.REARVY_AUTOMATON_DIR || process.env.REARVY_AUTOMATION_DIR || path.join(rootDir, "automaton"));
const outputDir = path.join(desktopDir, ".generated", "automaton");
const automatonRequired = process.env.REARVY_AUTOMATON_REQUIRED === "1";
const requiredRuntimePaths = [
  "package.json",
  "pnpm-lock.yaml",
  "scripts/rearvy-runner.js",
  "dist/index.js",
];

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

function getMissingRuntimePaths() {
  if (!fs.existsSync(sourceDir)) {
    return [...requiredRuntimePaths];
  }

  return requiredRuntimePaths.filter((relativePath) => !fs.existsSync(path.join(sourceDir, relativePath)));
}

function formatMissingRuntimeMessage(missingPaths) {
  if (!fs.existsSync(sourceDir)) {
    return `Automaton source not found at ${sourceDir}. Set REARVY_AUTOMATON_DIR or check out/build automaton at ${path.join(
      rootDir,
      "automaton"
    )}.`;
  }

  return `Automaton runtime is missing ${missingPaths
    .map((relativePath) => `${relativePath} at ${path.join(sourceDir, relativePath)}`)
    .join(", ")}. Run "cd automaton && npm run build".`;
}

function writeUnavailableRuntime(reason) {
  fs.rmSync(outputDir, { recursive: true, force: true });
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(
    path.join(outputDir, "README.txt"),
    [
      "Rearvy Automaton runtime was not packaged.",
      "",
      reason,
      "",
      "The desktop app will still build, but the Automaton page will report the runtime as unavailable.",
      "Set REARVY_AUTOMATON_DIR to a built Automaton checkout before packaging to include the real runner.",
      "Set REARVY_AUTOMATON_REQUIRED=1 to make missing runtime files fail the build.",
      "",
    ].join("\n")
  );
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
const missingRuntimePaths = getMissingRuntimePaths();
if (missingRuntimePaths.length > 0) {
  const reason = formatMissingRuntimeMessage(missingRuntimePaths);
  if (automatonRequired) {
    throw new Error(reason);
  }

  console.warn(`Skipping Automaton runtime packaging: ${reason}`);
  writeUnavailableRuntime(reason);
  console.log(`Prepared unavailable Automaton marker at ${outputDir}`);
  process.exit(0);
}

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
