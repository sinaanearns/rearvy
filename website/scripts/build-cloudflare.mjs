import fs from "node:fs";
import { syncBuiltinESMExports } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function resolveFallbackTarget(target, linkPath) {
  if (path.isAbsolute(target)) {
    return target;
  }

  const fromLinkParent = path.resolve(path.dirname(linkPath), target);
  if (fs.existsSync(fromLinkParent)) {
    return fromLinkParent;
  }

  return path.resolve(process.cwd(), target);
}

function installWindowsSymlinkFallback() {
  if (process.platform !== "win32") {
    return;
  }

  const originalSymlinkSync = fs.symlinkSync;

  fs.symlinkSync = function symlinkSyncWithWindowsFallback(target, linkPath, type) {
    try {
      return originalSymlinkSync.call(fs, target, linkPath, type);
    } catch (error) {
      if (error?.code !== "EPERM" && error?.code !== "EACCES") {
        throw error;
      }

      const resolvedTarget = resolveFallbackTarget(String(target), String(linkPath));
      const targetStats = fs.statSync(resolvedTarget);

      if (targetStats.isDirectory()) {
        try {
          return originalSymlinkSync.call(fs, resolvedTarget, linkPath, "junction");
        } catch (junctionError) {
          if (
            junctionError?.code !== "EPERM" &&
            junctionError?.code !== "EACCES"
          ) {
            throw junctionError;
          }

          fs.cpSync(resolvedTarget, linkPath, {
            dereference: true,
            force: true,
            recursive: true,
          });
          return undefined;
        }
      }

      fs.copyFileSync(resolvedTarget, linkPath);
      return undefined;
    }
  };

  syncBuiltinESMExports();
}

function patchOpenNextWorkerdStringExports() {
  const workerdPath = path.resolve(
    __dirname,
    "../node_modules/@opennextjs/cloudflare/dist/cli/build/utils/workerd.js"
  );
  const source = fs.readFileSync(workerdPath, "utf8");
  const guard =
    'export function transformBuildCondition(conditionMap, condition) {\n    if (typeof conditionMap !== "object" || conditionMap === null) {\n        return { transformedExports: conditionMap, hasBuildCondition: false };\n    }\n\n';

  if (source.includes(guard)) {
    return;
  }

  const target = "export function transformBuildCondition(conditionMap, condition) {\n";
  if (!source.includes(target)) {
    throw new Error("Unable to patch OpenNext workerd package export handling.");
  }

  fs.writeFileSync(workerdPath, source.replace(target, guard));
}

installWindowsSymlinkFallback();

process.env.OPEN_NEXT_BUILD = "true";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cliPath = path.resolve(
  __dirname,
  "../node_modules/@opennextjs/cloudflare/dist/cli/index.js"
);

patchOpenNextWorkerdStringExports();

process.argv = [
  process.argv[0],
  "opennextjs-cloudflare",
  "build",
  "--skipWranglerConfigCheck",
  ...process.argv.slice(2),
];

await import(pathToFileURL(cliPath).href);
