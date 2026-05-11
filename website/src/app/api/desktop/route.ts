import { NextResponse } from "next/server";
import { createRequire } from "module";

declare global {
  var __rearvy_desktop_started__: boolean | undefined;
}

export async function GET() {
  // Only allow in development
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ ok: false, message: "not-in-development" }, { status: 400 });
  }

  if ((global as any).__rearvy_desktop_started__) {
    return NextResponse.json({ ok: true, started: true });
  }

  const isWin = process.platform === "win32";
  const npmCmd = isWin ? "npm.cmd" : "npm";

  try {
    // Lazy-require modules to avoid build-time tracing
    const require = createRequire(import.meta.url);
    const { spawn } = require("child_process");
    const fs = require("fs");
    const path = require("path");

    // Find the repository root containing a package.json with the `desktop:dev` script.
    let repoRoot = process.cwd();
    let found = false;
    while (true) {
      const pkgPath = path.join(repoRoot, "package.json");
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
          if (pkg && pkg.scripts && pkg.scripts["desktop:dev"]) {
            found = true;
            break;
          }
        } catch (e) {
          // ignore JSON parse errors and keep walking up
        }
      }
      const parent = path.dirname(repoRoot);
      if (parent === repoRoot) break;
      repoRoot = parent;
    }

    if (!found) {
      console.warn("Desktop launch skipped: no desktop:dev script found in ancestor package.json");
      return NextResponse.json({ ok: false, message: "desktop-launch-unavailable" }, { status: 200 });
    }

    // Launch `npm run desktop:dev` detached so it continues independently
    const child = spawn(npmCmd, ["run", "desktop:dev"], {
      cwd: repoRoot,
      env: process.env,
      detached: true,
      stdio: "ignore",
    });

    // Allow the child to continue running after Next process exits
    child.unref();

    // Mark as started to avoid duplicate launches
    (global as any).__rearvy_desktop_started__ = true;

    return NextResponse.json({ ok: true, started: true });
  } catch (err) {
    // Log the error but don't return 500 - desktop launch is optional
    console.warn("Desktop launch error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false, message: "desktop-launch-unavailable" }, { status: 200 });
  }
}
