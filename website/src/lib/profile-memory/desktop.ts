import type { ProfileMemoryEntry } from "./types";

/**
 * Static catalog of software the desktop app probes for when the user starts
 * the chat for the first time. Each entry maps the executable to the slot
 * it should fill. Probe results become high-importance `desktop_scan`
 * memory entries.
 *
 * The list is intentionally narrow: the chat extractor's KNOWN_SOFTWARE
 * lexicon will pick up the long tail of products the user mentions by name.
 */
export const DESKTOP_PROBE_TARGETS: ReadonlyArray<{
  appPath: string;
  aliases: string[];
  slot: ProfileMemoryEntry["slot"];
  display: string;
  importance: number;
}> = [
  // Video editing
  { appPath: "Resolve.exe", aliases: ["DaVinci Resolve", "davinci resolve"], slot: "video_editor", display: "DaVinci Resolve", importance: 9 },
  { appPath: "Adobe Premiere Pro.exe", aliases: ["Premiere Pro", "premiere"], slot: "video_editor", display: "Adobe Premiere Pro", importance: 9 },
  { appPath: "Final Cut Pro.app", aliases: ["Final Cut"], slot: "video_editor", display: "Final Cut Pro", importance: 9 },
  { appPath: "CapCut.exe", aliases: ["CapCut"], slot: "video_editor", display: "CapCut", importance: 7 },
  { appPath: "Filmora.exe", aliases: ["Filmora"], slot: "video_editor", display: "Filmora", importance: 7 },

  // Code editors
  { appPath: "Code.exe", aliases: ["VS Code", "code"], slot: "code_editor", display: "VS Code", importance: 9 },
  { appPath: "WebStorm64.exe", aliases: ["WebStorm"], slot: "code_editor", display: "WebStorm", importance: 8 },
  { appPath: "idea64.exe", aliases: ["IntelliJ IDEA", "IntelliJ"], slot: "code_editor", display: "IntelliJ IDEA", importance: 8 },
  { appPath: "pycharm64.exe", aliases: ["PyCharm"], slot: "code_editor", display: "PyCharm", importance: 8 },
  { appPath: "sublime_text.exe", aliases: ["Sublime Text"], slot: "code_editor", display: "Sublime Text", importance: 7 },
  { appPath: "notepad++.exe", aliases: ["Notepad++"], slot: "code_editor", display: "Notepad++", importance: 7 },

  // AI coding assistants
  { appPath: "codex.exe", aliases: ["Codex"], slot: "ai_coding_assistant", display: "Codex", importance: 9 },
  { appPath: "Cursor.exe", aliases: ["Cursor"], slot: "ai_coding_assistant", display: "Cursor", importance: 9 },
  { appPath: "GitHub Copilot", aliases: ["GitHub Copilot"], slot: "ai_coding_assistant", display: "GitHub Copilot", importance: 8 },
  { appPath: "claude.exe", aliases: ["Claude Code"], slot: "ai_coding_assistant", display: "Claude Code", importance: 8 },
  { appPath: "Continue.exe", aliases: ["Continue.dev"], slot: "ai_coding_assistant", display: "Continue.dev", importance: 7 },

  // Design
  { appPath: "Figma.exe", aliases: ["Figma"], slot: "design_software", display: "Figma", importance: 8 },
  { appPath: "Photoshop.exe", aliases: ["Photoshop"], slot: "design_software", display: "Adobe Photoshop", importance: 8 },
  { appPath: "Illustrator.exe", aliases: ["Illustrator"], slot: "design_software", display: "Adobe Illustrator", importance: 7 },
  { appPath: "Canva.exe", aliases: ["Canva"], slot: "design_software", display: "Canva", importance: 6 },

  // Communication
  { appPath: "Slack.exe", aliases: ["Slack"], slot: "communication", display: "Slack", importance: 7 },
  { appPath: "Teams.exe", aliases: ["Microsoft Teams"], slot: "communication", display: "Microsoft Teams", importance: 7 },
  { appPath: "Discord.exe", aliases: ["Discord"], slot: "communication", display: "Discord", importance: 7 },
  { appPath: "Zoom.exe", aliases: ["Zoom"], slot: "communication", display: "Zoom", importance: 7 },

  // Productivity
  { appPath: "Notion.exe", aliases: ["Notion"], slot: "productivity", display: "Notion", importance: 8 },
  { appPath: "Obsidian.exe", aliases: ["Obsidian"], slot: "productivity", display: "Obsidian", importance: 7 },
  { appPath: "WINWORD.EXE", aliases: ["Microsoft Word"], slot: "productivity", display: "Microsoft Word", importance: 6 },
  { appPath: "EXCEL.EXE", aliases: ["Microsoft Excel"], slot: "productivity", display: "Microsoft Excel", importance: 6 },

  // Browsers
  { appPath: "chrome.exe", aliases: ["Google Chrome", "Chrome"], slot: "browser", display: "Google Chrome", importance: 7 },
  { appPath: "msedge.exe", aliases: ["Microsoft Edge", "Edge"], slot: "browser", display: "Microsoft Edge", importance: 7 },
  { appPath: "firefox.exe", aliases: ["Firefox"], slot: "browser", display: "Firefox", importance: 7 },
  { appPath: "brave.exe", aliases: ["Brave"], slot: "browser", display: "Brave", importance: 6 },

  // Terminal / shell
  { appPath: "WindowsTerminal.exe", aliases: ["Windows Terminal"], slot: "terminal", display: "Windows Terminal", importance: 7 },
  { appPath: "powershell.exe", aliases: ["PowerShell"], slot: "terminal", display: "PowerShell", importance: 7 },

  // Music / audio
  { appPath: "Spotify.exe", aliases: ["Spotify"], slot: "music_or_audio", display: "Spotify", importance: 6 },
  { appPath: "Audacity.exe", aliases: ["Audacity"], slot: "music_or_audio", display: "Audacity", importance: 7 },
];

export type DesktopProbeInstallStatus = "installed" | "missing" | "error";

export type DesktopProbeResult = {
  appPath: string;
  display: string;
  status: DesktopProbeInstallStatus;
  detail?: string;
  slot: ProfileMemoryEntry["slot"];
  importance: number;
};

export function describeDesktopProbeResult(result: DesktopProbeResult) {
  if (result.status === "installed") {
    return result.display;
  }
  if (result.status === "missing") {
    return null;
  }
  return null;
}
