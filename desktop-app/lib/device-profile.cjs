/**
 * device-profile.cjs
 *
 * Captures the user's installed software profile on first launch so the
 * model never has to re-ask. Scans ALL installed apps on the system (not
 * just a hardcoded list), categorizes them via the static app map + optional
 * AI fallback, persists results to userData as device-profile.json, and
 * broadcasts to the renderer through the IPC channel.
 */
"use strict";

const fs = require("fs/promises");
const path = require("path");
const { createLogger } = require("./logger.cjs");
const { scanAllInstalledApps } = require("./app-scanner.cjs");
const { categorizeApps } = require("./app-categorizer.cjs");

const log = createLogger("DeviceProfile");

const DEVICE_PROFILE_FILENAME = "device-profile.json";

// ─── Legacy probe targets kept for backward compatibility with the IPC
// normalizeEntries helper in route.ts. New captures use the full scanner.
const DESKTOP_PROBE_TARGETS = [
  // Video editing
  { appPath: "Resolve.exe", slot: "video_editor", display: "DaVinci Resolve", importance: 9 },
  { appPath: "Adobe Premiere Pro.exe", slot: "video_editor", display: "Adobe Premiere Pro", importance: 9 },
  { appPath: "CapCut.exe", slot: "video_editor", display: "CapCut", importance: 7 },
  { appPath: "Filmora.exe", slot: "video_editor", display: "Filmora", importance: 7 },

  // Code editors
  { appPath: "Code.exe", slot: "code_editor", display: "VS Code", importance: 9 },
  { appPath: "WebStorm64.exe", slot: "code_editor", display: "WebStorm", importance: 8 },
  { appPath: "idea64.exe", slot: "code_editor", display: "IntelliJ IDEA", importance: 8 },
  { appPath: "sublime_text.exe", slot: "code_editor", display: "Sublime Text", importance: 7 },
  { appPath: "notepad++.exe", slot: "code_editor", display: "Notepad++", importance: 7 },

  // AI coding assistants
  { appPath: "codex.exe", slot: "ai_coding_assistant", display: "Codex", importance: 9 },
  { appPath: "Cursor.exe", slot: "ai_coding_assistant", display: "Cursor", importance: 9 },
  { appPath: "claude.exe", slot: "ai_coding_assistant", display: "Claude Code", importance: 8 },

  // Design
  { appPath: "Figma.exe", slot: "design_software", display: "Figma", importance: 8 },
  { appPath: "Photoshop.exe", slot: "design_software", display: "Adobe Photoshop", importance: 8 },
  { appPath: "Canva.exe", slot: "design_software", display: "Canva", importance: 6 },

  // Communication
  { appPath: "Slack.exe", slot: "communication", display: "Slack", importance: 7 },
  { appPath: "Teams.exe", slot: "communication", display: "Microsoft Teams", importance: 7 },
  { appPath: "Discord.exe", slot: "communication", display: "Discord", importance: 7 },
  { appPath: "Zoom.exe", slot: "communication", display: "Zoom", importance: 7 },

  // Productivity
  { appPath: "Notion.exe", slot: "productivity", display: "Notion", importance: 8 },
  { appPath: "Obsidian.exe", slot: "productivity", display: "Obsidian", importance: 7 },
  { appPath: "WINWORD.EXE", slot: "productivity", display: "Microsoft Word", importance: 6 },
  { appPath: "EXCEL.EXE", slot: "productivity", display: "Microsoft Excel", importance: 6 },

  // Browsers
  { appPath: "chrome.exe", slot: "browser", display: "Google Chrome", importance: 7 },
  { appPath: "msedge.exe", slot: "browser", display: "Microsoft Edge", importance: 7 },
  { appPath: "firefox.exe", slot: "browser", display: "Firefox", importance: 7 },
  { appPath: "brave.exe", slot: "browser", display: "Brave", importance: 6 },

  // Terminal / shell
  { appPath: "WindowsTerminal.exe", slot: "terminal", display: "Windows Terminal", importance: 7 },
  { appPath: "powershell.exe", slot: "terminal", display: "PowerShell", importance: 7 },

  // Music / audio
  { appPath: "Spotify.exe", slot: "music_or_audio", display: "Spotify", importance: 6 },
  { appPath: "Audacity.exe", slot: "music_or_audio", display: "Audacity", importance: 7 },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function defaultPath() {
  try {
    const { app } = require("electron");
    if (app && typeof app.getPath === "function") {
      return path.join(app.getPath("userData"), DEVICE_PROFILE_FILENAME);
    }
  } catch (error) {
    void error;
  }
  return path.join(process.cwd(), DEVICE_PROFILE_FILENAME);
}

function humanLabel(slot) {
  const wellKnown = {
    video_editor: "Video editor",
    code_editor: "Code editor",
    ai_coding_assistant: "AI coding assistant",
    design_software: "Design software",
    communication: "Communication app",
    productivity: "Productivity app",
    browser: "Default browser",
    terminal: "Terminal or shell",
    music_or_audio: "Music or audio tool",
    other_software: "Other software",
  };
  if (wellKnown[slot]) return wellKnown[slot];
  // Dynamic slots: snake_case → Title case
  return slot.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());
}

function buildSnapshot(entries, options = {}) {
  return {
    entries: entries.map((entry) => ({
      ...entry,
      label: humanLabel(entry.slot),
    })),
    updated_at: new Date().toISOString(),
    source: "desktop_scan",
    platform: process.platform,
    scanned_at: new Date().toISOString(),
    duration_ms: typeof options.durationMs === "number" ? options.durationMs : null,
    scan_mode: "full_scan",
  };
}

async function writeSnapshot(filePath, snapshot) {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const tmpPath = `${filePath}.tmp`;
  await fs.writeFile(tmpPath, JSON.stringify(snapshot, null, 2), "utf8");
  await fs.rename(tmpPath, filePath);
}

async function readSnapshot(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (error) {
    if (error && error.code !== "ENOENT") {
      log.debug("device profile not loaded:", error?.message || error);
    }
    return null;
  }
}

// ─── Main Capture ─────────────────────────────────────────────────────────────

/**
 * Full-device capture:
 * 1. Scans ALL installed apps via Get-StartApps + Registry + Shortcuts
 * 2. Categorizes via the static 200+ app map
 * 3. Sends unrecognized apps to the AI API for dynamic categorization
 * 4. Persists the snapshot to disk and returns it
 *
 * @param {{ filePath?: string, apiBaseUrl?: string, authToken?: string }} options
 */
async function captureDeviceProfile(options = {}) {
  const filePath = isString(options.filePath) ? options.filePath : defaultPath();
  const start = Date.now();

  log.info("Starting full-device app scan...");
  const installedApps = await scanAllInstalledApps();
  log.info(`Found ${installedApps.length} installed apps`);

  const entries = await categorizeApps(installedApps, {
    apiBaseUrl: options.apiBaseUrl,
    authToken: options.authToken,
  });

  log.info(`Categorized ${entries.length} apps into profile memory entries`);

  const snapshot = buildSnapshot(entries, { durationMs: Date.now() - start });
  await writeSnapshot(filePath, snapshot);

  log.info(
    `Captured device profile: ${snapshot.entries.length} entries from ${installedApps.length} installed apps in ${snapshot.duration_ms}ms`
  );

  return { snapshot, entries, filePath };
}

module.exports = {
  captureDeviceProfile,
  readDeviceProfileSnapshot: readSnapshot,
  writeDeviceProfileSnapshot: writeSnapshot,
  DESKTOP_PROBE_TARGETS,
};
