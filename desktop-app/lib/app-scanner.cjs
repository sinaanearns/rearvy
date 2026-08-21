/**
 * app-scanner.cjs
 *
 * Enumerates ALL installed applications on the system — not just a hardcoded
 * probe list. Uses three complementary sources on Windows:
 *
 *   1. Get-StartApps   — modern UWP + packaged apps visible in Start Menu
 *   2. Registry Uninstall keys  — traditionally installed Win32 apps
 *   3. Start Menu shortcut folders — .lnk files in Start Menu directories
 *
 * Each source returns `InstalledApp` objects. Results are deduplicated by
 * normalized name. The full scan completes within SCAN_TIMEOUT_MS.
 */
"use strict";

const { execFile } = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs/promises");
const { createLogger } = require("./logger.cjs");

const log = createLogger("AppScanner");

const SCAN_TIMEOUT_MS = 20_000;

/**
 * @typedef {{
 *   name: string,
 *   publisher?: string,
 *   exePath?: string,
 *   source: 'start_menu' | 'registry' | 'shortcut',
 *   appId?: string,
 * }} InstalledApp
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeName(name) {
  return (name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Runs a PowerShell command and returns stdout string.
 * Rejects after timeoutMs.
 */
function runPowerShell(script, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-OutputFormat", "Text", "-Command", script],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
      (err, stdout, stderr) => {
        if (err) {
          reject(err);
        } else {
          resolve(stdout || "");
        }
      }
    );
    const timer = setTimeout(() => {
      try { child.kill(); } catch (_) { /* ignore */ }
      reject(new Error(`PowerShell scan timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    child.once("close", () => clearTimeout(timer));
  });
}

function safeParsePsJson(text) {
  if (!text || !text.trim()) return [];
  try {
    const parsed = JSON.parse(text.trim());
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

// ─── Source 1: Get-StartApps ─────────────────────────────────────────────────

/**
 * Returns all apps listed in the Windows Start Menu via Get-StartApps.
 * Includes both UWP/packaged apps and traditional installers that register
 * themselves in the Start Menu.
 * @returns {Promise<InstalledApp[]>}
 */
async function scanStartMenuApps() {
  if (process.platform !== "win32") return [];
  try {
    const script = `Get-StartApps | Where-Object { $_.Name -and $_.AppID } | Select-Object Name, AppID | ConvertTo-Json -Compress`;
    const output = await runPowerShell(script, 10000);
    const items = safeParsePsJson(output);
    return items
      .filter((item) => item && item.Name)
      .map((item) => ({
        name: String(item.Name).trim(),
        appId: item.AppID ? String(item.AppID).trim() : undefined,
        source: /** @type {'start_menu'} */ ("start_menu"),
      }));
  } catch (err) {
    log.debug("Start menu scan failed:", err?.message || err);
    return [];
  }
}

// ─── Source 2: Registry Uninstall Keys ───────────────────────────────────────

/**
 * Reads Windows Uninstall registry keys to find traditionally installed apps.
 * Covers both per-user (HKCU) and per-machine (HKLM) installs.
 * @returns {Promise<InstalledApp[]>}
 */
async function scanRegistryApps() {
  if (process.platform !== "win32") return [];
  try {
    const script = [
      "$paths = @(",
      "  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall',",
      "  'HKLM:\\Software\\Wow6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',",
      "  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall'",
      ")",
      "$results = New-Object System.Collections.Generic.List[object]",
      "foreach ($regPath in $paths) {",
      "  try {",
      "    Get-ChildItem $regPath -ErrorAction SilentlyContinue | ForEach-Object {",
      "      $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue",
      "      if ($props.DisplayName -and $props.DisplayName.Trim() -ne '') {",
      "        $results.Add([PSCustomObject]@{",
      "          Name = $props.DisplayName.Trim()",
      "          Publisher = if ($props.Publisher) { $props.Publisher.Trim() } else { '' }",
      "          InstallLocation = if ($props.InstallLocation) { $props.InstallLocation.Trim() } else { '' }",
      "        })",
      "      }",
      "    }",
      "  } catch {}",
      "}",
      "$results | Select-Object Name, Publisher, InstallLocation -Unique | ConvertTo-Json -Compress",
    ].join("\n");

    const output = await runPowerShell(script, 15000);
    const items = safeParsePsJson(output);
    return items
      .filter((item) => item && item.Name)
      .map((item) => ({
        name: String(item.Name).trim(),
        publisher: item.Publisher ? String(item.Publisher).trim() || undefined : undefined,
        exePath: item.InstallLocation ? String(item.InstallLocation).trim() || undefined : undefined,
        source: /** @type {'registry'} */ ("registry"),
      }));
  } catch (err) {
    log.debug("Registry scan failed:", err?.message || err);
    return [];
  }
}

// ─── Source 3: Start Menu Shortcut Folders ───────────────────────────────────

/**
 * Lists .lnk shortcut names from the Windows Start Menu folders.
 * Catches apps that don't appear in Get-StartApps or the registry.
 * @returns {Promise<InstalledApp[]>}
 */
async function scanStartMenuShortcuts() {
  if (process.platform !== "win32") return [];
  const startMenuPaths = [
    path.join(process.env.APPDATA || "", "Microsoft", "Windows", "Start Menu", "Programs"),
    path.join(process.env.ProgramData || "C:\\ProgramData", "Microsoft", "Windows", "Start Menu", "Programs"),
  ].filter(Boolean);

  const apps = [];
  for (const dir of startMenuPaths) {
    try {
      const entries = await readDirRecursive(dir, ".lnk");
      for (const entry of entries) {
        const name = path.basename(entry, ".lnk").trim();
        if (name && name.toLowerCase() !== "uninstall" && name.length > 1) {
          apps.push({
            name,
            source: /** @type {'shortcut'} */ ("shortcut"),
          });
        }
      }
    } catch {
      // Directory may not exist
    }
  }
  return apps;
}

async function readDirRecursive(dir, ext, results = []) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await readDirRecursive(fullPath, ext, results);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(ext)) {
      results.push(fullPath);
    }
  }
  return results;
}

// ─── Deduplication ───────────────────────────────────────────────────────────

/**
 * Merges results from all sources, deduplicating by normalized name.
 * Priority: start_menu > registry > shortcut (higher sources win on conflict).
 * @param {InstalledApp[][]} groups
 * @returns {InstalledApp[]}
 */
function deduplicateApps(groups) {
  const sourcePriority = { start_menu: 3, registry: 2, shortcut: 1 };
  const map = new Map();

  for (const group of groups) {
    for (const app of group) {
      const key = normalizeName(app.name);
      if (!key || key.length < 2) continue;
      const existing = map.get(key);
      const priority = sourcePriority[app.source] ?? 0;
      if (!existing || (sourcePriority[existing.source] ?? 0) < priority) {
        map.set(key, app);
      }
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

// ─── Filters ────────────────────────────────────────────────────────────────

const SKIP_NAME_PATTERNS = [
  /^microsoft\s+(edge|onedrive|defender|update|store|teams machine-wide|visual\s*c\+\+|\.net|sql|expression|access\s*database|office\s*(hub|shared|telemetry|click-to-run))/i,
  /^windows\s+(sdk|adk|driver kit|assessment|update|subsystem|web\s*services|iot\s*core|kits|hardware\s*lab)/i,
  /^(uninstall|setup|installer|install\s*helper|redistributable|runtime|report\s*viewer)/i,
  /^(visual\s*c\+\+|vc\+\+|msvc)\s+\d{4}/i,
  /^(directx|intel\s*(chipset|driver|mgt|network|graphics)\s*(install|software))/i,
  /^(driver|realtek|nvidia\s*(physx|geforce\s*experience\s*components))/i,
  /\btelemetry\b|\bdiagnostic\b|\bcrash\s*report/i,
];

/**
 * Returns true if the app name should be filtered out (system components,
 * redistributables, drivers, etc.).
 */
function shouldSkipApp(app) {
  const name = app.name || "";
  if (name.length < 2) return true;
  for (const pattern of SKIP_NAME_PATTERNS) {
    if (pattern.test(name)) return true;
  }
  return false;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Scans ALL installed applications on the current machine.
 * Returns a deduplicated, filtered list within SCAN_TIMEOUT_MS.
 *
 * @returns {Promise<InstalledApp[]>}
 */
async function scanAllInstalledApps() {
  const withTimeout = (promise, label) =>
    Promise.race([
      promise.catch((err) => {
        log.debug(`${label} scan error:`, err?.message || err);
        return [];
      }),
      new Promise((resolve) => setTimeout(() => resolve([]), SCAN_TIMEOUT_MS - 2000)),
    ]);

  const [startMenuApps, registryApps, shortcutApps] = await Promise.all([
    withTimeout(scanStartMenuApps(), "StartMenu"),
    withTimeout(scanRegistryApps(), "Registry"),
    withTimeout(scanStartMenuShortcuts(), "Shortcuts"),
  ]);

  const all = deduplicateApps([startMenuApps, registryApps, shortcutApps]);
  const filtered = all.filter((app) => !shouldSkipApp(app));

  log.info(
    `App scan complete: ${startMenuApps.length} start_menu + ${registryApps.length} registry + ${shortcutApps.length} shortcuts → ${filtered.length} unique apps after filtering`
  );

  return filtered;
}

module.exports = {
  scanAllInstalledApps,
  SCAN_TIMEOUT_MS,
};
