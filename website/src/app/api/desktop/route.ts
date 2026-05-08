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
    // Lazy-require child_process to avoid build-time tracing
    const require = createRequire(import.meta.url);
    const { spawn } = require("child_process");

    // Launch `npm run desktop:dev` detached so it continues independently
    const child = spawn(npmCmd, ["run", "desktop:dev"], {
      cwd: process.cwd(),
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
