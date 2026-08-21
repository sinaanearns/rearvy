const { execFile } = require("node:child_process");

function ignoreExpectedPortOwnerError(error) {
  void error;
}

function execFileText(command, args) {
  return new Promise((resolve) => {
    execFile(
      command,
      args,
      {
        timeout: 3000,
        windowsHide: true,
      },
      (_error, stdout) => {
        resolve(stdout || "");
      }
    );
  });
}

function parseWindowsNetstat(stdout, port) {
  const targetPort = Number(port);
  if (!Number.isFinite(targetPort)) {
    return [];
  }

  const pids = new Set();
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.toUpperCase().startsWith("TCP ")) {
      continue;
    }

    const parts = trimmed.split(/\s+/);
    const localAddress = parts[1] || "";
    const state = (parts[3] || "").toUpperCase();
    const pid = parts[4] || "";

    if (state !== "LISTENING" || !pid) {
      continue;
    }

    if (localAddress.endsWith(`:${targetPort}`) || localAddress.endsWith(`]:${targetPort}`)) {
      pids.add(pid);
    }
  }

  return Array.from(pids);
}

async function getWindowsPortOwnerPids(port) {
  const stdout = await execFileText("netstat.exe", ["-ano", "-p", "tcp"]);
  return parseWindowsNetstat(stdout, port);
}

async function getUnixPortOwnerPids(port) {
  const stdout = await execFileText("lsof", ["-nP", "-iTCP:" + Number(port), "-sTCP:LISTEN", "-t"]);
  return stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

async function getPortOwnerPids(port) {
  try {
    if (process.platform === "win32") {
      return await getWindowsPortOwnerPids(port);
    }

    return await getUnixPortOwnerPids(port);
  } catch (error) {
    ignoreExpectedPortOwnerError(error);
    return [];
  }
}

async function getPortOwnerSummary(port) {
  const pids = await getPortOwnerPids(port);
  if (pids.length === 0) {
    return "";
  }

  return `PID${pids.length === 1 ? "" : "s"} ${pids.join(", ")}`;
}

async function getPortKillCommand(port) {
  const pids = await getPortOwnerPids(port);
  if (pids.length === 0) {
    return "";
  }

  if (process.platform === "win32") {
    return `taskkill ${pids.map((pid) => `/PID ${pid}`).join(" ")} /F`;
  }

  return `kill -9 ${pids.join(" ")}`;
}

module.exports = {
  getPortKillCommand,
  getPortOwnerPids,
  getPortOwnerSummary,
};
