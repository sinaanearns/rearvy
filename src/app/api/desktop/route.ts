import { NextResponse } from "next/server";
import { spawn } from "child_process";

declare global {
  // eslint-disable-next-line no-var
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
    // Launch `npm run desktop:launch` detached so it continues independently
    const child = spawn(npmCmd, ["run", "desktop:launch"], {
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
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
