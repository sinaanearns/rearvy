import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function toPowerShellSingleQuoted(value: string) {
  return `'${value.replace(/'/g, "''")}'`;
}

export function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (url.searchParams.get("win32") !== "true") {
    return NextResponse.json(
      {
        error: "unsupported-installer",
        message: "Use /install?win32=true from PowerShell on Windows.",
      },
      { status: 400 }
    );
  }

  const installerUrl =
    process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL ||
    new URL("/downloads/RearvyUserSetup-x64.exe", request.url).toString();

  const installerName = "RearvyUserSetup-x64.exe";
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "if ($env:OS -ne 'Windows_NT') { throw 'Rearvy Desktop installer is only available for Windows.' }",
    `$installerUrl = ${toPowerShellSingleQuoted(installerUrl)}`,
    `$installerName = ${toPowerShellSingleQuoted(installerName)}`,
    "$downloadDir = Join-Path $env:TEMP 'RearvyInstall'",
    "New-Item -ItemType Directory -Force -Path $downloadDir | Out-Null",
    "$installerPath = Join-Path $downloadDir $installerName",
    "Write-Host 'Downloading Rearvy Desktop installer...'",
    "Invoke-WebRequest -Uri $installerUrl -OutFile $installerPath -UseBasicParsing",
    "Write-Host 'Starting Rearvy Setup...'",
    "Start-Process -FilePath $installerPath",
  ].join("\r\n");

  return new NextResponse(`${script}\r\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
