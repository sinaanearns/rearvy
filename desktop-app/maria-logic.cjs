const { ipcMain, shell, screen } = require("electron");
const { spawn } = require("child_process");
const os = require("os");
const path = require("path");
const { MariaMemoryStore } = require("./lib/maria-memory.cjs");
const { WorkflowExecutor } = require("./lib/workflow-executor.cjs");
const { isScreenReadIntent } = require("./lib/screen-intent.cjs");
const { getExecutor } = require("./automation-integration.cjs");
const { createLogger } = require("./lib/logger.cjs");

const log = createLogger("Maria");

function ignoreExpectedMariaParseError(error) {
  void error;
}

let robot = null;
let robotAvailable = false;
try {
  // robotjs is a native dependency that may not be available on all
  // platforms or in development environments. Require it lazily
  // and fall back to a graceful no-op implementation when missing.
  robot = require("robotjs");
  robotAvailable = true;
} catch (err) {
  log.warn("robotjs not available - mouse simulation disabled:", err?.message || err);
}

// Ensure a working fetch implementation is available in the main process
let fetchFn = typeof fetch === "function" ? fetch : null;
if (!fetchFn) {
    try {
    // node-fetch v3+ is ESM; require may resolve a compatible CJS build in some
    // environments. This is best-effort — if unavailable, callFirecrawl will
    // throw a clear error when attempting to use it.
    fetchFn = require("node-fetch");
  } catch (e) {
    fetchFn = null;
  }
}

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
const MARIA_CHAT_PATH = "/api/maria/chat";
const FIRECRAWL_RESEARCH_KEYWORDS = ["research", "find", "look up", "search", "what's on", "what is on", "summarize", "explain"];
const DESKTOP_WORKFLOW_COMMAND_PATTERNS = [
  /^(?:run|execute)\s+(?:a\s+)?(?:terminal\s+)?(?:command|shell|powershell)\s*:?\s+(.+)$/i,
  /^(?:terminal|shell|powershell)\s*:?\s+(.+)$/i,
  /^(?:take|capture|get)\s+(?:a\s+)?(?:(?:desktop|screen)\s+)?screenshot$/i,
  /^screenshot$/i,
  /^(?:open|launch|start)\s+(.+)$/i,
  /^(?:read|show)\s+(?:the\s+)?(?:file|text file)\s+(.+)$/i,
  /^(?:list|show|read|scan|inspect)\s+(?:(?:the|my)\s+)?(?:folder|directory|dir)\s+(.+)$/i,
  /^(?:what(?:'s| is)\s+in|show\s+me\s+what(?:'s| is)\s+(?:inside|in))\s+(.+)$/i,
  /^(?:reveal|show)\s+(.+?)\s+(?:in\s+)?(?:file explorer|explorer|folder)$/i,
  /^(?:write|save)\s+(.+?)\s+to\s+(?:file\s+)?(.+)$/i,
  /^(?:move\s+(?:the\s+)?mouse\s+(?:to\s+)?|mouse\s+to\s+)-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?$/i,
  /^(?:drag|drag\s+(?:the\s+)?mouse)\s+(?:from\s+)?-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?\s+(?:to|->)\s+-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?$/i,
  /^(?:mouse\s+down|hold\s+(?:the\s+)?mouse)(?:\s+(left|right|middle))?$/i,
  /^(?:mouse\s+up|release\s+(?:the\s+)?mouse)(?:\s+(left|right|middle))?$/i,
  /^(?:(?:left|right|double)\s+)?click(?:\s+(?:at|on))?\s+-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?$/i,
  /^(?:type|enter\s+text)\s+(.+)$/i,
  /^(?:press|hit)\s+(.+)$/i,
  /^(?:copy|set)\s+(?:the\s+)?clipboard\s+(?:to|as)\s+(.+)$/i,
  /^copy\s+(.+)\s+to\s+(?:the\s+)?clipboard$/i,
  /^(?:read|show|get)\s+(?:the\s+)?clipboard$/i,
  /^scroll\s+(?:up|down|left|right)(?:\s+\d+)?$/i,
  /^close\s+(?:the\s+)?(?:active\s+)?window$/i,
];
const SCREEN_ISSUE_ASSIST_PATTERNS = [
  /\b(?:fix|handle|resolve|solve|deal\s+with)\b.*\b(?:it|this|that|screen|issue|problem|error|popup|dialog|permission|warning)\b/i,
  /\b(?:use|control)\b.*\b(?:mouse|cursor)\b/i,
  /\b(?:use|control|move|take\s+over)\b.*\b(?:pointer|clicker)\b/i,
  /\b(?:click|press|select|tap|choose)\b\s+(?:it|that|this|there|here)\b/i,
  /\b(?:click|press|select|tap|choose)\b\s+(?:the\s+)?(?:right|correct|best|needed|appropriate|visible)\b/i,
  /\b(?:click|press|select|tap|choose|open)\b\s+(?:on\s+)?(?:the\s+)?[\w .'-]{1,80}\b(?:button|link|icon|menu|option|checkbox|control|popup|dialog|window|field|box|tab|item)\b/i,
  /\b(?:click|tap)\b\s+(?:on\s+)?(?:the\s+)?[\w .'-]{1,64}$/i,
  /\b(?:do|finish|continue|proceed|handle)\s+(?:it|this|that|for\s+me)\b/i,
  /\b(?:let|make)\s+(?:maria|clicky|rearvy|it)\s+(?:use|control|click|read)\b.*\b(?:mouse|cursor|pointer|screen|device|computer)\b/i,
  /\b(?:click|press|select|tap)\b\s+(?:on\s+)?(?:the\s+)?(?:visible\s+)?(?:button|link|icon|menu|option|checkbox|control|popup|dialog|window|field|box|tab|item|thing|one|this|that)\b/i,
  /\b(?:click|press|select)\b.*\b(?:right|correct|best|needed|appropriate)\b/i,
  /\bwhat\s+(?:to\s+do|should\s+i\s+(?:do|click|press))\b/i,
  /\bguide\s+me\b.*\b(?:next|screen|issue|step)\b/i,
  /\b(?:permission|microphone|mic|audio|camera)\b.*\b(?:fix|allow|enable|permission|issue|error|unavailable)\b/i,
];
const MIN_VISIBLE_ACTION_CONFIDENCE = 0.45;
const MARIA_CONVERSATION_HISTORY_LIMIT = 8;
const MARIA_CONVERSATION_TURN_MAX_LENGTH = 700;
const SENSITIVE_DISCLOSURE_PATTERNS = [
  /\b(send|share|give|show|export|download|leak)\b.*\b(files?|documents?|docs?|business files?|private files?|credentials?|passwords?|keys?|secrets?|data)\b/i,
  /\b(business|private|confidential|internal)\b.*\b(files?|documents?|docs?|data|info|information)\b/i,
  /\b(access|open|read)\b.*\b(my|your|the)\b.*\b(files?|drive|folder|email|emails|inbox|account)\b/i,
];
const BROWSER_AUTH_TARGETS = [
  { label: "Gmail", url: "https://mail.google.com", aliases: ["gmail", "google mail"] },
  { label: "Google", url: "https://accounts.google.com", aliases: ["google", "google account"] },
  { label: "YouTube", url: "https://www.youtube.com", aliases: ["youtube"] },
  { label: "Instagram", url: "https://www.instagram.com", aliases: ["instagram"] },
  { label: "Facebook", url: "https://www.facebook.com", aliases: ["facebook"] },
  { label: "LinkedIn", url: "https://www.linkedin.com", aliases: ["linkedin"] },
  { label: "X", url: "https://x.com", aliases: ["x", "twitter"] },
  { label: "GitHub", url: "https://github.com", aliases: ["github"] },
  { label: "Shopify", url: "https://www.shopify.com/login", aliases: ["shopify"] },
  { label: "Notion", url: "https://www.notion.so/login", aliases: ["notion"] },
  { label: "Figma", url: "https://www.figma.com/login", aliases: ["figma"] },
];
const BROWSER_OPEN_TARGETS = [
  { label: "Gmail", url: "https://mail.google.com", aliases: ["gmail", "google mail"] },
  { label: "Google Drive", url: "https://drive.google.com", aliases: ["google drive", "drive"] },
  { label: "Google Docs", url: "https://docs.google.com/document", aliases: ["google docs", "docs"] },
  { label: "Google Sheets", url: "https://docs.google.com/spreadsheets", aliases: ["google sheets", "sheets"] },
  { label: "Google Slides", url: "https://docs.google.com/presentation", aliases: ["google slides", "slides"] },
  { label: "Google", url: "https://www.google.com", aliases: ["google"] },
  { label: "YouTube", url: "https://www.youtube.com", aliases: ["youtube"] },
  { label: "Instagram", url: "https://www.instagram.com", aliases: ["instagram"] },
  { label: "Facebook", url: "https://www.facebook.com", aliases: ["facebook"] },
  { label: "LinkedIn", url: "https://www.linkedin.com", aliases: ["linkedin"] },
  { label: "X", url: "https://x.com", aliases: ["x", "twitter"] },
  { label: "TikTok", url: "https://www.tiktok.com", aliases: ["tiktok"] },
  { label: "Reddit", url: "https://www.reddit.com", aliases: ["reddit"] },
  { label: "GitHub", url: "https://github.com", aliases: ["github"] },
  { label: "GitLab", url: "https://gitlab.com", aliases: ["gitlab"] },
  { label: "Notion", url: "https://www.notion.so", aliases: ["notion"] },
  { label: "Figma", url: "https://www.figma.com", aliases: ["figma"] },
  { label: "Shopify", url: "https://www.shopify.com", aliases: ["shopify"] },
  { label: "Amazon", url: "https://www.amazon.com", aliases: ["amazon"] },
  { label: "Netflix", url: "https://www.netflix.com", aliases: ["netflix"] },
  { label: "Rearvy", url: "https://www.rearvy.com", aliases: ["rearvy"] },
];

/**
 * Maria Logic - The Brain of the Mouse Assistant
 *
 * This file refactors the previous monolithic execute flow into a small
 * perception -> planning -> execution pipeline. The public IPC surface
 * (`maria:command`, `maria:status`) is preserved so the UI/preload
 * bridge does not need to change.
 */
class MariaBrain {
  constructor(mainWindow, mariaWindow, appUrl) {
    this.mainWindow = mainWindow;
    this.mariaWindow = mariaWindow;
    this.appUrl = appUrl;
    this.isThinking = false;
    this.activeAbortController = null;
    this.latestAssistantEvent = null;
    this.activeReplyMetadata = {};
    this.mariaWorkflowExecutor = null;
    this.memoryStore = new MariaMemoryStore();
    this.conversationHistory = [];
  }

  setWindows({ mainWindow, mariaWindow, appUrl } = {}) {
    if (mainWindow !== undefined) {
      this.mainWindow = mainWindow;
    }

    if (mariaWindow !== undefined) {
      this.mariaWindow = mariaWindow;
    }

    if (appUrl) {
      this.appUrl = appUrl;
    }

    this.mariaWorkflowExecutor?.setMainWindow?.(this.mainWindow);
  }

  async captureMainWindow() {
    if (!this.mainWindow || !this.mainWindow.webContents || typeof this.mainWindow.webContents.capturePage !== "function") {
      return null;
    }

    const image = await this.mainWindow.webContents.capturePage();
    return image && typeof image.toDataURL === "function" ? image.toDataURL() : null;
  }

  async captureDesktopScreens() {
    const { desktopCapturer } = require("electron");
    const displays = typeof screen?.getAllDisplays === "function" ? screen.getAllDisplays() : [];
    const cursorPoint = typeof screen?.getCursorScreenPoint === "function" ? screen.getCursorScreenPoint() : null;
    const cursorDisplay =
      cursorPoint && typeof screen?.getDisplayNearestPoint === "function"
        ? screen.getDisplayNearestPoint(cursorPoint)
        : null;
    const displayById = new Map(displays.map((display) => [String(display.id), display]));
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    });

    const screenshots = (sources || [])
      .map((source, index) => {
        const image = source?.thumbnail && typeof source.thumbnail.toDataURL === "function"
          ? source.thumbnail.toDataURL()
          : "";
        if (!image || source.thumbnail?.isEmpty?.()) {
          return null;
        }
        const thumbnailSize = typeof source.thumbnail?.getSize === "function"
          ? source.thumbnail.getSize()
          : null;

        const display =
          displayById.get(String(source.display_id || "")) ||
          displays[index] ||
          null;
        const bounds = display?.bounds || null;
        const isCursorScreen = Boolean(
          (cursorDisplay && display && String(cursorDisplay.id) === String(display.id)) ||
            (bounds &&
              cursorPoint &&
              cursorPoint.x >= bounds.x &&
              cursorPoint.x < bounds.x + bounds.width &&
              cursorPoint.y >= bounds.y &&
              cursorPoint.y < bounds.y + bounds.height)
        );

        return {
          image,
          label: sources.length === 1
            ? "User screen (cursor is here)"
            : isCursorScreen
              ? `Screen ${index + 1} of ${sources.length} - cursor is here`
              : `Screen ${index + 1} of ${sources.length}`,
          isCursorScreen,
          bounds: bounds
            ? {
                x: Number(bounds.x) || 0,
                y: Number(bounds.y) || 0,
                width: Number(bounds.width) || 0,
                height: Number(bounds.height) || 0,
              }
            : null,
          width: Number(thumbnailSize?.width) || 0,
          height: Number(thumbnailSize?.height) || 0,
        };
      })
      .filter(Boolean);

    if (screenshots.length > 0 && !screenshots.some((screenshot) => screenshot.isCursorScreen)) {
      screenshots[0].isCursorScreen = true;
      screenshots[0].label =
        sources.length === 1
          ? "User screen (cursor is here)"
          : `${screenshots[0].label} - cursor screen fallback`;
    }

    return screenshots.sort((a, b) => Number(b.isCursorScreen) - Number(a.isCursorScreen));
  }

  async captureDesktopScreen() {
    const screenshots = await this.captureDesktopScreens();
    return screenshots[0]?.image || null;
  }

  async perceiveScreenContext(options = {}) {
    const preferDesktop = Boolean(options.preferDesktop);

    try {
      if (preferDesktop) {
        try {
          const desktopScreenshots = await this.captureDesktopScreens();
          if (desktopScreenshots.length > 0) {
            return {
              primaryDataUrl: desktopScreenshots[0].image,
              primary: desktopScreenshots[0],
              screenshots: desktopScreenshots,
            };
          }
        } catch (err) {
          log.warn("desktop screen context failed, falling back to capturePage:", err?.message || err);
        }
      }

      const pageImage = await this.captureMainWindow();
      if (pageImage) {
        const pageScreenshot = {
          image: pageImage,
          label: "Rearvy desktop window",
          isCursorScreen: true,
          bounds: typeof this.mainWindow?.getBounds === "function" ? this.mainWindow.getBounds() : null,
          width: 0,
          height: 0,
        };
        return {
          primaryDataUrl: pageImage,
          primary: pageScreenshot,
          screenshots: [pageScreenshot],
        };
      }

      if (!preferDesktop) {
        const desktopScreenshots = await this.captureDesktopScreens();
        if (desktopScreenshots.length > 0) {
          return {
            primaryDataUrl: desktopScreenshots[0].image,
            primary: desktopScreenshots[0],
            screenshots: desktopScreenshots,
          };
        }
      }
    } catch (err) {
      log.warn("perceiveScreenContext() failed:", err?.message || err);
    }

    return { primaryDataUrl: null, primary: null, screenshots: [] };
  }

  // Capture the screen as a data URL (if available).
  async perceive(options = {}) {
    const preferDesktop = Boolean(options.preferDesktop);

    try {
      if (preferDesktop) {
        try {
          const desktopImage = await this.captureDesktopScreen();
          if (desktopImage) return desktopImage;
        } catch (err) {
          log.warn("desktop capture failed, falling back to capturePage:", err?.message || err);
        }
      }

      // Prefer using the main window's capturePage API when available.
      try {
        const pageImage = await this.captureMainWindow();
        if (pageImage) return pageImage;
      } catch (err) {
        log.warn("capturePage failed, falling back to desktopCapturer:", err?.message || err);
      }

      if (!preferDesktop) {
        return await this.captureDesktopScreen();
      }
    } catch (err) {
      // Non-fatal: perception may not be available on all platforms or dev environments
      log.warn("perceive() failed:", err?.message || err);
    }
    return null;
  }

  getFirecrawlApiKey() {
    return process.env.FIRECRAWL_API_KEY || process.env.REARVY_FIRECRAWL_API_KEY || "";
  }

  getMariaChatUrl() {
    const baseUrl =
      this.appUrl ||
      process.env.REARVY_DESKTOP_APP_URL ||
      process.env.REARVY_DESKTOP_DEV_URL ||
      "http://localhost:3000";

    return new URL(MARIA_CHAT_PATH, baseUrl).toString();
  }

  emitAssistantEvent(event) {
    this.latestAssistantEvent = event;

    if (this.mariaWindow && !this.mariaWindow.isDestroyed()) {
      this.mariaWindow.webContents.send("maria:assistant-event", event);
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("maria:assistant-event", event);
    }
  }

  emitAssistantReply(reply, metadata = {}) {
    const text = this.truncateForSpeech(reply);
    if (!text) {
      return;
    }

    this.emitAssistantEvent({
      ...this.activeReplyMetadata,
      ...metadata,
      type: "assistant-reply",
      reply: text,
      message: text,
    });
  }

  normalizeCommandPayload(value) {
    if (value && typeof value === "object") {
      return {
        command: this.normalizeAssistantText(value.command || value.text || value.message),
        requestId: this.normalizeAssistantText(value.requestId),
        origin: this.normalizeAssistantText(value.origin),
      };
    }

    return {
      command: this.normalizeAssistantText(value),
      requestId: "",
      origin: "",
    };
  }

  normalizeAssistantText(value) {
    return String(value || "").trim();
  }

  normalizeConversationText(value, maxLength = MARIA_CONVERSATION_TURN_MAX_LENGTH) {
    const text = this.normalizeAssistantText(value).replace(/\s+/g, " ");
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 3).trimEnd()}...`;
  }

  getRecentConversationHistory() {
    return this.conversationHistory.slice(-MARIA_CONVERSATION_HISTORY_LIMIT).map((turn) => ({
      user: turn.user,
      assistant: turn.assistant,
    }));
  }

  rememberConversationTurn(userText, assistantText) {
    const user = this.normalizeConversationText(userText);
    const assistant = this.normalizeConversationText(assistantText);

    if (!user || !assistant) {
      return;
    }

    const lastTurn = this.conversationHistory[this.conversationHistory.length - 1];
    if (lastTurn?.user === user && lastTurn?.assistant === assistant) {
      return;
    }

    this.conversationHistory.push({
      user,
      assistant,
      recordedAt: new Date().toISOString(),
    });

    if (this.conversationHistory.length > MARIA_CONVERSATION_HISTORY_LIMIT) {
      this.conversationHistory = this.conversationHistory.slice(-MARIA_CONVERSATION_HISTORY_LIMIT);
    }
  }

  normalizeIntentText(value) {
    return this.normalizeAssistantText(value)
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[\u2019\u2018]/g, "'")
      .replace(/\bu\b/g, "you")
      .replace(/\b(?:cliky|clicy|clickie)\b/g, "clicky")
      .replace(/\bsmatter\b/g, "smarter")
      .replace(/\b(?:devive|devuce|deivce)\b/g, "device")
      .replace(/\b(?:compter|coputer|computor)\b/g, "computer")
      .replace(/\b(?:mose|mouze)\b/g, "mouse")
      .replace(/\bcurser\b/g, "cursor")
      .replace(/\s+/g, " ")
      .trim();
  }

  isStopCommand(command) {
    const normalized = this.normalizeAssistantText(command).toLowerCase();
    return normalized === "stop" || normalized === "pause" || normalized === "cancel";
  }

  isAbortError(error) {
    return error?.name === "AbortError" || /aborted|aborterror/i.test(String(error?.message || error));
  }

  throwIfStopped(signal) {
    if (!signal?.aborted) {
      return;
    }

    const error = new Error("Maria request stopped.");
    error.name = "AbortError";
    throw error;
  }

  truncateForSpeech(value, maxLength = 360) {
    const text = this.normalizeAssistantText(value).replace(/\s+/g, " ");
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 3).trimEnd()}...`;
  }

  parsePointingCoordinates(responseText) {
    const text = this.normalizeAssistantText(responseText);
    const match = text.match(/\[POINT:(?:none|(\d+)\s*,\s*(\d+)(?::([^\]:\s][^\]:]*?))?(?::screen(\d+))?)\]\s*$/i);
    if (!match) {
      return {
        spokenText: text,
        coordinate: null,
        elementLabel: null,
        screenNumber: null,
      };
    }

    const tagStart = match.index ?? text.length;
    const spokenText = text.slice(0, tagStart).trim();
    const x = Number(match[1]);
    const y = Number(match[2]);

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        spokenText,
        coordinate: null,
        elementLabel: "none",
        screenNumber: null,
      };
    }

    return {
      spokenText,
      coordinate: { x, y },
      elementLabel: this.truncateForSpeech(match[3] || "this", 60),
      screenNumber: Number.isFinite(Number(match[4])) ? Number(match[4]) : null,
    };
  }

  resolvePointingTarget(pointing, screenshots) {
    if (!pointing?.coordinate || !Array.isArray(screenshots) || screenshots.length === 0) {
      return null;
    }

    const requestedScreenNumber = Number(pointing.screenNumber);
    const targetScreenshot = Number.isFinite(requestedScreenNumber) && requestedScreenNumber > 0
      ? screenshots.find((screenshot) => new RegExp(`\\bscreen\\s+${requestedScreenNumber}\\b`, "i").test(String(screenshot?.label || ""))) ||
        screenshots[requestedScreenNumber - 1]
      : screenshots.find((screenshot) => screenshot?.isCursorScreen) || screenshots[0];

    const bounds = targetScreenshot?.bounds;
    if (!bounds) {
      return null;
    }

    const boundsWidth = Number(bounds.width);
    const boundsHeight = Number(bounds.height);
    if (!Number.isFinite(boundsWidth) || !Number.isFinite(boundsHeight) || boundsWidth <= 0 || boundsHeight <= 0) {
      return null;
    }

    const imageWidth = Number(targetScreenshot.width) || Number(targetScreenshot.screenshotWidth) || boundsWidth;
    const imageHeight = Number(targetScreenshot.height) || Number(targetScreenshot.screenshotHeight) || boundsHeight;
    const clampedX = Math.max(0, Math.min(Number(pointing.coordinate.x), imageWidth));
    const clampedY = Math.max(0, Math.min(Number(pointing.coordinate.y), imageHeight));

    return {
      x: Math.round(Number(bounds.x) + clampedX * (boundsWidth / imageWidth)),
      y: Math.round(Number(bounds.y) + clampedY * (boundsHeight / imageHeight)),
      label: pointing.elementLabel || "this",
      screenNumber: pointing.screenNumber || null,
    };
  }

  emitPointingEvent(pointing, screenshots, command) {
    const target = this.resolvePointingTarget(pointing, screenshots);
    if (!target) {
      return;
    }

    this.emitAssistantEvent({
      type: "screen-point",
      command: this.normalizeAssistantText(command),
      x: target.x,
      y: target.y,
      label: target.label,
      screenNumber: target.screenNumber,
      spokenText: pointing.spokenText,
    });
  }

  isResearchCommand(normalizedCommand) {
    return FIRECRAWL_RESEARCH_KEYWORDS.some((keyword) => normalizedCommand.includes(keyword));
  }

  isScreenAnalysisCommand(normalizedCommand) {
    return isScreenReadIntent(normalizedCommand);
  }

  looksLikeUrl(normalizedCommand) {
    return (
      /https?:\/\//i.test(normalizedCommand) ||
      /^www\./i.test(normalizedCommand) ||
      /^[a-zA-Z][a-zA-Z0-9+.-]{2,}:/.test(normalizedCommand)
    );
  }

  isCalendarCommand(normalizedCommand) {
    const text = this.normalizeAssistantText(normalizedCommand).toLowerCase();
    const spaced = text.replace(/[_-]+/g, " ");

    return (
      spaced === "check calendar" ||
      spaced === "check my calendar" ||
      spaced === "calendar" ||
      /\b(check|open|show|read|inspect|review)\b.*\b(calendar|schedule|agenda)\b/.test(spaced) ||
      /\b(what'?s|what is)\b.*\b(calendar|schedule|agenda)\b/.test(spaced)
    );
  }

  stripWrappingQuotes(value) {
    const text = this.normalizeAssistantText(value);
    if (
      (text.startsWith('"') && text.endsWith('"')) ||
      (text.startsWith("'") && text.endsWith("'"))
    ) {
      return text.slice(1, -1).trim();
    }

    return text;
  }

  parseCoordinatePair(xValue, yValue) {
    const x = Number(xValue);
    const y = Number(yValue);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return null;
    }

    return { x: Math.round(x), y: Math.round(y) };
  }

  normalizeKeyPressTarget(value) {
    const text = this.stripWrappingQuotes(value).replace(/\s*\+\s*/g, "+");
    if (text.includes("+")) {
      return text;
    }

    const parts = text.split(/\s+/).filter(Boolean);
    const modifierWords = new Set(["ctrl", "control", "cmd", "command", "meta", "shift", "alt", "option"]);
    if (parts.length > 1 && parts.slice(0, -1).every((part) => modifierWords.has(part.toLowerCase()))) {
      return parts.join("+");
    }

    return text;
  }

  isDesktopWorkflowCommand(command) {
    const text = this.normalizeIntentText(command);
    return DESKTOP_WORKFLOW_COMMAND_PATTERNS.some((pattern) => pattern.test(text));
  }

  isScreenIssueAssistCommand(command) {
    const text = this.normalizeIntentText(command);
    return SCREEN_ISSUE_ASSIST_PATTERNS.some((pattern) => pattern.test(text));
  }

  getScreenSizeForMousePlan() {
    if (robotAvailable && robot && typeof robot.getScreenSize === "function") {
      try {
        const size = robot.getScreenSize();
        const width = Number(size?.width);
        const height = Number(size?.height);
        if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
          return { width, height };
        }
      } catch (error) {
        log.warn("Could not read screen size:", error?.message || error);
      }
    }

    return { width: 1920, height: 1080 };
  }

  normalizeVisibleActionPlan(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    const action = value.action === "click" ? "click" : "none";
    const label = this.truncateForSpeech(value.label || (action === "click" ? "Click visible control" : "No safe action"), 80);
    const reason = this.truncateForSpeech(value.reason || "I could not identify one safe mouse action from the visible screen.", 220);
    const confidence = Number(value.confidence);
    const normalizedConfidence = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
    const risk = ["low", "medium", "high"].includes(value.risk) ? value.risk : "medium";
    const x = Number(value.x);
    const y = Number(value.y);

    if (action !== "click") {
      return { action: "none", label, reason, confidence: normalizedConfidence, risk };
    }

    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      return {
        action: "none",
        label: "No safe action",
        reason: "The suggested mouse action did not include usable screen coordinates.",
        confidence: 0,
        risk: "medium",
      };
    }

    return {
      action: "click",
      label,
      reason,
      x: Math.min(1, Math.max(0, x)),
      y: Math.min(1, Math.max(0, y)),
      confidence: normalizedConfidence,
      risk,
    };
  }

  buildDesktopWorkflow(idSuffix, name, description, steps) {
    return {
      id: `maria_${idSuffix}_${Date.now()}`,
      name,
      description,
      source: "template",
      requiresApproval: false,
      steps,
    };
  }

  buildSingleStepDesktopWorkflow(idSuffix, name, description, action, timeout = 10000) {
    return this.buildDesktopWorkflow(idSuffix, name, description, [
      {
        id: `step_${idSuffix}`,
        name,
        action,
        timeout,
      },
    ]);
  }

  looksLikeFilePath(value) {
    const text = this.normalizeAssistantText(value);
    return (
      /^[a-zA-Z]:[\\/]/.test(text) ||
      /^~?[\\/]/.test(text) ||
      /^\.[\\/]/.test(text) ||
      /[\\/]/.test(text)
    );
  }

  getHomeDirectory() {
    return os.homedir?.() || process.env.USERPROFILE || process.env.HOME || "";
  }

  resolveKnownDirectoryTarget(target) {
    const homeDir = this.getHomeDirectory();
    const normalized = this.normalizeIntentText(target)
      .replace(/^(?:the|my)\s+/, "")
      .replace(/\s+(?:folder|directory|dir)$/i, "")
      .trim();

    if (!homeDir) {
      return null;
    }

    const knownDirectories = {
      home: homeDir,
      user: homeDir,
      "user folder": homeDir,
      profile: homeDir,
      desktop: path.join(homeDir, "Desktop"),
      downloads: path.join(homeDir, "Downloads"),
      documents: path.join(homeDir, "Documents"),
      docs: path.join(homeDir, "Documents"),
      pictures: path.join(homeDir, "Pictures"),
      photos: path.join(homeDir, "Pictures"),
      music: path.join(homeDir, "Music"),
      videos: path.join(homeDir, "Videos"),
    };

    return knownDirectories[normalized] || null;
  }

  resolveDirectoryTarget(target) {
    const rawTarget = this.stripWrappingQuotes(target);
    const knownDirectory = this.resolveKnownDirectoryTarget(rawTarget);
    if (knownDirectory) {
      return knownDirectory;
    }

    if (rawTarget.startsWith("~/") || rawTarget.startsWith("~\\")) {
      const homeDir = this.getHomeDirectory();
      return homeDir ? `${homeDir}${rawTarget.slice(1)}` : rawTarget;
    }

    return rawTarget;
  }

  normalizeOpenTarget(target) {
    const text = this.stripWrappingQuotes(target);
    if (/^www\./i.test(text)) {
      return `https://${text}`;
    }

    return text
      .replace(/\s+(?:from|on|in)\s+(?:the\s+|my\s+)?(?:desktop|computer|pc|windows)$/i, "")
      .replace(/\s+(?:desktop\s+)?(?:app|application|program|window)$/i, "")
      .trim();
  }

  getAppAlias(target) {
    const normalized = this.normalizeAssistantText(target).toLowerCase();
    const aliases = {
      browser: "https://www.google.com",
      "web browser": "https://www.google.com",
      "default browser": "https://www.google.com",
      chrome: "chrome.exe",
      "chrome browser": "chrome.exe",
      "google chrome": "chrome.exe",
      "chrome settings": "chrome://settings",
      "chrome setting": "chrome://settings",
      "chrome settings people": "chrome://settings/people",
      "chrome people settings": "chrome://settings/people",
      "chrome profile settings": "chrome://settings/people",
      edge: "msedge.exe",
      "edge browser": "msedge.exe",
      "microsoft edge": "msedge.exe",
      firefox: "firefox.exe",
      "firefox browser": "firefox.exe",
      "mozilla firefox": "firefox.exe",
      brave: "brave.exe",
      "brave browser": "brave.exe",
      opera: "opera.exe",
      antigravity: "Antigravity",
      atigravity: "Antigravity",
      antigavity: "Antigravity",
      antigravty: "Antigravity",
      "anti gravity": "Antigravity",
      "antigravity desktop": "Antigravity",
      "atigravity desktop": "Antigravity",
      "anti gravity desktop": "Antigravity",
      "antigravity ide": "Antigravity IDE",
      calculator: "calc.exe",
      calc: "calc.exe",
      notepad: "notepad.exe",
      paint: "mspaint.exe",
      explorer: "explorer.exe",
      "file explorer": "explorer.exe",
      terminal: "wt.exe",
      "windows terminal": "wt.exe",
      powershell: "powershell.exe",
      "power shell": "powershell.exe",
      cmd: "cmd.exe",
      "command prompt": "cmd.exe",
      outlook: "outlook.exe",
    };

    return aliases[normalized] || null;
  }

  inferBrowserOpenTarget(target) {
    const normalized = this.normalizeAssistantText(target).toLowerCase();
    if (!normalized) {
      return null;
    }

    for (const browserTarget of BROWSER_OPEN_TARGETS) {
      if (
        browserTarget.aliases.some((alias) =>
          new RegExp(`(^|\\b)${this.escapeRegExp(alias)}(\\b|$)`, "i").test(normalized)
        )
      ) {
        return browserTarget;
      }
    }

    return null;
  }

  isBrowserAuthCommand(command) {
    const text = this.normalizeAssistantText(command).toLowerCase();
    return (
      /\b(sign\s*up|signup|register|create\s+(?:an?\s+|my\s+|your\s+)?account|make\s+(?:an?\s+|my\s+|your\s+)?account)\b/i.test(text) ||
      /\b(?:log\s*in|sign\s*in|log\s*into|sign\s*into)\b/i.test(text) ||
      /\b(?:login|signin)\s+(?:to|into|with|at|on|for)\b/i.test(text) ||
      /\b(?:log|sign)\s+me\s+in\b/i.test(text) ||
      /\b(?:login|signin)\s+for\s+me\b/i.test(text)
    );
  }

  inferBrowserAuthTarget(command) {
    const text = this.normalizeAssistantText(command);
    const explicitUrl = this.extractUrl(command) || this.extractDomainUrl(command);
    if (explicitUrl) {
      return {
        label: this.describeUrlHost(explicitUrl),
        url: explicitUrl,
      };
    }

    const lower = text.toLowerCase();
    for (const target of BROWSER_AUTH_TARGETS) {
      if (
        target.aliases.some((alias) =>
          new RegExp(`(^|\\b)${this.escapeRegExp(alias)}(\\b|$)`, "i").test(lower)
        )
      ) {
        return target;
      }
    }

    return null;
  }

  buildBrowserAuthWorkflowFromCommand(command) {
    const target = this.inferBrowserAuthTarget(command);
    if (!target?.url) {
      return null;
    }

    return {
      summary: `Open ${target.label} in the browser for sign-in`,
      workflow: this.buildSingleStepDesktopWorkflow(
        "browser_auth",
        `Open ${target.label}`,
        `Open ${target.label} in the default browser. The user completes passwords, CAPTCHAs, 2FA, and payment steps directly in the browser.`,
        { type: "openPath", target: target.url, wait: true },
        20000
      ),
    };
  }

  buildOpenTargetAction(target) {
    const normalizedTarget = this.normalizeOpenTarget(target);
    const appAlias = this.getAppAlias(normalizedTarget);

    if (appAlias) {
      if (this.looksLikeUrl(appAlias.toLowerCase()) || /^[a-zA-Z][a-zA-Z0-9+.-]{2,}:/.test(appAlias)) {
        return { type: "openPath", target: appAlias, wait: true };
      }

      return { type: "launchApp", appPath: appAlias };
    }

    const browserTarget = this.inferBrowserOpenTarget(normalizedTarget);
    if (browserTarget?.url) {
      return { type: "openPath", target: browserTarget.url, wait: true };
    }

    if (this.looksLikeUrl(normalizedTarget.toLowerCase()) || this.looksLikeFilePath(normalizedTarget) || /^[a-zA-Z][a-zA-Z0-9+.-]{2,}:/.test(normalizedTarget)) {
      return { type: "openPath", target: normalizedTarget };
    }

    return { type: "launchApp", appPath: normalizedTarget };
  }

  quotePowerShellLiteral(value) {
    return `'${String(value || "").replace(/'/g, "''")}'`;
  }

  buildVisibleTerminalStartCommand(executables) {
    const candidates = executables
      .map((value) => this.normalizeAssistantText(value))
      .filter(Boolean);
    const candidateList = candidates.map((value) => this.quotePowerShellLiteral(value)).join(", ");

    return [
      "$ErrorActionPreference = 'Stop'",
      `$candidates = @(${candidateList})`,
      "$lastError = $null",
      "foreach ($candidate in $candidates) {",
      "  try {",
      "    Start-Process -FilePath $candidate -ErrorAction Stop",
      "    Write-Output \"Started $candidate\"",
      "    exit 0",
      "  } catch {",
      "    $lastError = $_.Exception.Message",
      "  }",
      "}",
      "throw \"Could not start a visible terminal. $lastError\"",
    ].join("; ");
  }

  getTerminalOpenPlan(target) {
    const normalizedTarget = this.normalizeOpenTarget(target).toLowerCase();

    if (/^(?:windows\s+terminal|wt)(?:\.exe)?$/.test(normalizedTarget)) {
      return {
        label: "Windows Terminal",
        executables: ["wt.exe"],
        windowTitles: ["Windows Terminal", "Terminal"],
      };
    }

    if (/^(?:powershell|power\s+shell|windows\s+powershell)(?:\.exe)?$/.test(normalizedTarget)) {
      return {
        label: "PowerShell",
        executables: ["powershell.exe"],
        windowTitles: ["Windows PowerShell", "PowerShell"],
      };
    }

    if (/^(?:cmd|cmd\.exe|command\s+prompt)$/.test(normalizedTarget)) {
      return {
        label: "Command Prompt",
        executables: ["cmd.exe"],
        windowTitles: ["Command Prompt", "cmd.exe", "cmd"],
      };
    }

    if (/^(?:terminal|shell)$/.test(normalizedTarget)) {
      return {
        label: "Terminal",
        executables: ["powershell.exe", "wt.exe", "cmd.exe"],
        windowTitles: ["Windows PowerShell", "PowerShell", "Windows Terminal", "Terminal", "Command Prompt", "cmd.exe", "cmd"],
      };
    }

    return null;
  }

  buildOpenTerminalWorkflow(target) {
    const terminalPlan = this.getTerminalOpenPlan(target);
    if (!terminalPlan) {
      return null;
    }

    return {
      summary: `Open ${terminalPlan.label}`,
      workflow: this.buildDesktopWorkflow(
        "open_terminal",
        `Open ${terminalPlan.label}`,
        `Open ${terminalPlan.label} and verify a terminal window is visible.`,
        [
          {
            id: "step_start_terminal",
            name: `Start ${terminalPlan.label}`,
            action: {
              type: "shellCommand",
              command: this.buildVisibleTerminalStartCommand(terminalPlan.executables),
            },
            timeout: 15000,
          },
          {
            id: "step_verify_terminal_window",
            name: "Verify terminal window",
            action: {
              type: "focusWindow",
              windowTitles: terminalPlan.windowTitles,
              timeoutMs: 12000,
            },
            timeout: 15000,
          },
        ]
      ),
    };
  }

  normalizeCalculatorInputToken(value) {
    const text = this.stripWrappingQuotes(value)
      .toLowerCase()
      .replace(/\b(?:button|key|app|application)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();

    const numberWords = {
      zero: "0",
      one: "1",
      two: "2",
      three: "3",
      four: "4",
      five: "5",
      six: "6",
      seven: "7",
      eight: "8",
      nine: "9",
    };

    if (/^-?\d+(?:\.\d+)?$/.test(text)) {
      return text;
    }

    if (numberWords[text]) {
      return numberWords[text];
    }

    if (/^(?:plus|add|\+)$/.test(text)) {
      return "+";
    }

    if (/^(?:minus|subtract|-)$/.test(text)) {
      return "-";
    }

    if (/^(?:times|multiply|multiplied by|x|\*)$/.test(text)) {
      return "*";
    }

    if (/^(?:divide|divided by|over|\/)$/.test(text)) {
      return "/";
    }

    if (/^(?:equals|equal|enter|=)$/.test(text)) {
      return "=";
    }

    return "";
  }

  extractCalculatorExpression(command) {
    const segments = this.normalizeAssistantText(command)
      .split(/[,.]/)
      .map((segment) => segment.trim())
      .filter(Boolean);
    const tokens = [];

    for (const segment of segments) {
      const normalized = segment.replace(/^then\s+/i, "").trim();
      const typeMatch = normalized.match(/^(?:type|enter\s+text|enter)\s+(.+)$/i);
      const pressMatch = normalized.match(/^(?:click|press|tap)(?:\s+(?:on|the))?\s+(.+)$/i);
      const rawToken = typeMatch?.[1] || pressMatch?.[1] || "";
      const token = this.normalizeCalculatorInputToken(rawToken);
      if (token) {
        tokens.push(token);
      }
    }

    const expression = tokens.join("").replace(/=+$/g, "");
    return /^-?\d+(?:\.\d+)?(?:[+\-*/]-?\d+(?:\.\d+)?)+$/.test(expression)
      ? expression
      : "";
  }

  buildCalculatorWorkflowFromCommand(command) {
    if (!/\b(?:calculator|calc)\b/i.test(command)) {
      return null;
    }

    const expression = this.extractCalculatorExpression(command);
    if (!expression) {
      return null;
    }

    return {
      summary: `Calculate ${expression}`,
      workflow: this.buildDesktopWorkflow("calculator", "Use Calculator", `Open Calculator and enter ${expression}.`, [
        {
          id: "step_open_calculator",
          name: "Open Calculator",
          action: this.buildOpenTargetAction("Calculator"),
          timeout: 15000,
        },
        {
          id: "step_wait_calculator",
          name: "Wait for Calculator",
          action: { type: "wait", ms: 800 },
          timeout: 3000,
        },
        {
          id: "step_type_expression",
          name: "Type calculation",
          action: { type: "type", text: expression },
          timeout: 10000,
        },
        {
          id: "step_press_equals",
          name: "Press equals",
          action: { type: "keyPress", key: "enter" },
          timeout: 5000,
        },
      ]),
    };
  }

  buildDesktopWorkflowFromCommand(command) {
    const text = this.normalizeAssistantText(command);
    if (!text) {
      return null;
    }

    const calculatorWorkflow = this.buildCalculatorWorkflowFromCommand(text);
    if (calculatorWorkflow) {
      return calculatorWorkflow;
    }

    const screenshotMatch =
      text.match(/^(?:take|capture|get)\s+(?:a\s+)?(?:(?:desktop|screen)\s+)?screenshot$/i) ||
      text.match(/^screenshot$/i);
    if (screenshotMatch) {
      return {
        summary: "Capture a desktop screenshot",
        workflow: this.buildSingleStepDesktopWorkflow(
          "screenshot",
          "Capture desktop screenshot",
          "Capture the visible desktop screen.",
          { type: "screenshot" },
          10000
        ),
      };
    }

    const moveMouseMatch = text.match(/^(?:move\s+(?:the\s+)?mouse\s+(?:to\s+)?|mouse\s+to\s+)(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)$/i);
    if (moveMouseMatch?.[1] && moveMouseMatch?.[2]) {
      const coords = this.parseCoordinatePair(moveMouseMatch[1], moveMouseMatch[2]);
      if (coords) {
        return {
          summary: `Move mouse to ${coords.x}, ${coords.y}`,
          workflow: this.buildSingleStepDesktopWorkflow(
            "move_mouse",
            "Move mouse",
            `Move mouse to ${coords.x}, ${coords.y}.`,
            { type: "moveMouse", ...coords },
            10000
          ),
        };
      }
    }

    const dragMouseMatch = text.match(/^(?:drag|drag\s+(?:the\s+)?mouse)\s+(?:from\s+)?(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)\s+(?:to|->)\s+(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)$/i);
    if (dragMouseMatch?.[1] && dragMouseMatch?.[2] && dragMouseMatch?.[3] && dragMouseMatch?.[4]) {
      const fromCoords = this.parseCoordinatePair(dragMouseMatch[1], dragMouseMatch[2]);
      const toCoords = this.parseCoordinatePair(dragMouseMatch[3], dragMouseMatch[4]);
      if (fromCoords && toCoords) {
        return {
          summary: `Drag mouse from ${fromCoords.x}, ${fromCoords.y} to ${toCoords.x}, ${toCoords.y}`,
          workflow: this.buildSingleStepDesktopWorkflow(
            "drag_mouse",
            "Drag mouse",
            `Drag mouse from ${fromCoords.x}, ${fromCoords.y} to ${toCoords.x}, ${toCoords.y}.`,
            {
              type: "dragMouse",
              fromX: fromCoords.x,
              fromY: fromCoords.y,
              toX: toCoords.x,
              toY: toCoords.y,
            },
            15000
          ),
        };
      }
    }

    const mouseDownMatch = text.match(/^(?:mouse\s+down|hold\s+(?:the\s+)?mouse)(?:\s+(left|right|middle))?$/i);
    if (mouseDownMatch) {
      const button = this.normalizeAssistantText(mouseDownMatch[1] || "left").toLowerCase();
      return {
        summary: `Hold ${button} mouse button`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "mouse_down",
          "Hold mouse button",
          `Hold the ${button} mouse button.`,
          { type: "mouseDown", button },
          10000
        ),
      };
    }

    const mouseUpMatch = text.match(/^(?:mouse\s+up|release\s+(?:the\s+)?mouse)(?:\s+(left|right|middle))?$/i);
    if (mouseUpMatch) {
      const button = this.normalizeAssistantText(mouseUpMatch[1] || "left").toLowerCase();
      return {
        summary: `Release ${button} mouse button`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "mouse_up",
          "Release mouse button",
          `Release the ${button} mouse button.`,
          { type: "mouseUp", button },
          10000
        ),
      };
    }

    const clickMatch = text.match(/^(?:(left|right|double)\s+)?click(?:\s+(?:at|on))?\s+(-?\d+(?:\.\d+)?)\s*,?\s+(-?\d+(?:\.\d+)?)$/i);
    if (clickMatch?.[2] && clickMatch?.[3]) {
      const coords = this.parseCoordinatePair(clickMatch[2], clickMatch[3]);
      if (coords) {
        const clickKind = this.normalizeAssistantText(clickMatch[1]).toLowerCase();
        const button = clickKind === "right" ? "right" : "left";
        const double = clickKind === "double";
        return {
          summary: `${double ? "Double click" : button === "right" ? "Right click" : "Click"} at ${coords.x}, ${coords.y}`,
          workflow: this.buildSingleStepDesktopWorkflow(
            "click",
            double ? "Double click" : button === "right" ? "Right click" : "Click",
            `Click at ${coords.x}, ${coords.y}.`,
            { type: "click", ...coords, button, double },
            10000
          ),
        };
      }
    }

    const typeTextMatch = text.match(/^(?:type|enter\s+text)\s+(.+)$/i);
    if (typeTextMatch?.[1]) {
      const typedText = this.stripWrappingQuotes(typeTextMatch[1]);
      return {
        summary: `Type text: ${this.truncateForSpeech(typedText, 80)}`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "type_text",
          "Type text",
          "Type text into the active app.",
          { type: "type", text: typedText },
          20000
        ),
      };
    }

    const keyPressMatch = text.match(/^(?:press|hit)\s+(.+)$/i);
    if (keyPressMatch?.[1]) {
      const key = this.normalizeKeyPressTarget(keyPressMatch[1]);
      return {
        summary: `Press key: ${key}`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "key_press",
          "Press key",
          `Press ${key}.`,
          { type: "keyPress", key },
          10000
        ),
      };
    }

    const setClipboardMatch =
      text.match(/^(?:copy|set)\s+(?:the\s+)?clipboard\s+(?:to|as)\s+(.+)$/i) ||
      text.match(/^copy\s+(.+)\s+to\s+(?:the\s+)?clipboard$/i);
    if (setClipboardMatch?.[1]) {
      const clipboardText = this.stripWrappingQuotes(setClipboardMatch[1]);
      return {
        summary: `Set clipboard: ${this.truncateForSpeech(clipboardText, 80)}`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "set_clipboard",
          "Set clipboard",
          "Set the system clipboard text.",
          { type: "setClipboard", text: clipboardText },
          10000
        ),
      };
    }

    const getClipboardMatch = text.match(/^(?:read|show|get)\s+(?:the\s+)?clipboard$/i);
    if (getClipboardMatch) {
      return {
        summary: "Read clipboard",
        workflow: this.buildSingleStepDesktopWorkflow(
          "get_clipboard",
          "Read clipboard",
          "Read the system clipboard text.",
          { type: "getClipboard" },
          10000
        ),
      };
    }

    const scrollMatch = text.match(/^scroll\s+(up|down|left|right)(?:\s+(\d+))?$/i);
    if (scrollMatch?.[1]) {
      const direction = scrollMatch[1].toLowerCase();
      const amount = scrollMatch[2] ? Number(scrollMatch[2]) : undefined;
      return {
        summary: `Scroll ${direction}${amount ? ` ${amount}` : ""}`,
        workflow: this.buildSingleStepDesktopWorkflow(
          "scroll",
          "Scroll",
          `Scroll ${direction}.`,
          { type: "scroll", direction, ...(amount ? { amount } : {}) },
          10000
        ),
      };
    }

    const closeWindowMatch = text.match(/^close\s+(?:the\s+)?(?:active\s+)?window$/i);
    if (closeWindowMatch) {
      return {
        summary: "Close the active window",
        workflow: this.buildSingleStepDesktopWorkflow(
          "close_window",
          "Close active window",
          "Close the active desktop window.",
          { type: "closeWindow" },
          10000
        ),
      };
    }

    const shellMatch =
      text.match(/^(?:run|execute)\s+(?:a\s+)?(?:terminal\s+)?(?:command|shell|powershell)\s*:?\s+(.+)$/i) ||
      text.match(/^(?:terminal|shell|powershell)\s*:?\s+(.+)$/i);
    if (shellMatch?.[1]) {
      const shellCommand = shellMatch[1].trim();
      return {
        summary: `Run terminal command: ${shellCommand}`,
        workflow: this.buildDesktopWorkflow("shell", "Run terminal command", `Run: ${shellCommand}`, [
          {
            id: "step_shell_command",
            name: "Run terminal command",
            action: { type: "shellCommand", command: shellCommand },
            timeout: 120000,
          },
        ]),
      };
    }

    const readFileMatch = text.match(/^(?:read|show)\s+(?:the\s+)?(?:file|text file)\s+(.+)$/i);
    if (readFileMatch?.[1]) {
      const filePath = this.stripWrappingQuotes(readFileMatch[1]);
      return {
        summary: `Read file: ${filePath}`,
        workflow: this.buildDesktopWorkflow("read_file", "Read file", `Read ${filePath}`, [
          {
            id: "step_read_file",
            name: "Read file",
            action: { type: "readFile", filePath },
            timeout: 10000,
          },
        ]),
      };
    }

    const listDirectoryMatch =
      text.match(/^(?:list|show|read|scan|inspect)\s+(?:(?:the|my)\s+)?(?:folder|directory|dir)\s+(.+)$/i) ||
      text.match(/^(?:what(?:'s| is)\s+in|show\s+me\s+what(?:'s| is)\s+(?:inside|in))\s+(.+)$/i) ||
      text.match(/^(?:list|show|read|scan|inspect)\s+(?:my\s+)?(desktop|downloads|documents|docs|home|user folder|profile|pictures|photos|music|videos)$/i);
    if (listDirectoryMatch?.[1]) {
      const directoryPath = this.resolveDirectoryTarget(listDirectoryMatch[1]);
      return {
        summary: `List directory: ${directoryPath}`,
        workflow: this.buildDesktopWorkflow("list_directory", "List folder", `List ${directoryPath}`, [
          {
            id: "step_list_directory",
            name: "List folder",
            action: { type: "listDirectory", path: directoryPath },
            timeout: 10000,
          },
        ]),
      };
    }

    const revealMatch = text.match(/^(?:reveal|show)\s+(.+?)\s+(?:in\s+)?(?:file explorer|explorer|folder)$/i);
    if (revealMatch?.[1]) {
      const target = this.stripWrappingQuotes(revealMatch[1]);
      return {
        summary: `Reveal path: ${target}`,
        workflow: this.buildDesktopWorkflow("reveal_path", "Reveal path", `Reveal ${target}`, [
          {
            id: "step_reveal_path",
            name: "Reveal path",
            action: { type: "revealPath", target },
            timeout: 10000,
          },
        ]),
      };
    }

    const writeFileMatch = text.match(/^(?:write|save)\s+(.+?)\s+to\s+(?:file\s+)?(.+)$/i);
    if (writeFileMatch?.[1] && writeFileMatch?.[2]) {
      const content = this.stripWrappingQuotes(writeFileMatch[1]);
      const filePath = this.stripWrappingQuotes(writeFileMatch[2]);
      return {
        summary: `Write file: ${filePath}`,
        workflow: this.buildDesktopWorkflow("write_file", "Write file", `Write ${filePath}`, [
          {
            id: "step_write_file",
            name: "Write file",
            action: { type: "writeFile", filePath, content },
            timeout: 10000,
          },
        ]),
      };
    }

    const openMatch = text.match(/^(?:open|launch|start)\s+(.+)$/i);
    if (openMatch?.[1]) {
      const target = this.stripWrappingQuotes(openMatch[1]);
      if (this.isCalendarCommand(target)) {
        return null;
      }

      const terminalWorkflow = this.buildOpenTerminalWorkflow(target);
      if (terminalWorkflow) {
        return terminalWorkflow;
      }

      return {
        summary: `Open ${target}`,
        workflow: this.buildDesktopWorkflow("open", "Open app or path", `Open ${target}`, [
          {
            id: "step_open_target",
            name: "Open app or path",
            action: this.buildOpenTargetAction(target),
            timeout: 20000,
          },
        ]),
      };
    }

    return null;
  }

  isSensitiveDisclosureRequest(command) {
    const text = this.normalizeAssistantText(command);
    return SENSITIVE_DISCLOSURE_PATTERNS.some((pattern) => pattern.test(text));
  }

  extractUrl(command) {
    const text = this.normalizeAssistantText(command);
    const match = text.match(/https?:\/\/[^\s]+|www\.[^\s]+/i);

    if (!match) {
      return null;
    }

    const extracted = match[0].startsWith("http") ? match[0] : `https://${match[0]}`;
    return extracted.replace(/[)\].,!?:;]+$/g, "");
  }

  extractDomainUrl(command) {
    const text = this.normalizeAssistantText(command);
    const match = text.match(/\b((?:[a-z0-9-]+\.)+[a-z]{2,})(?:\/[^\s)]*)?/i);

    if (!match?.[0]) {
      return null;
    }

    return `https://${match[0].replace(/[)\].,!?:;]+$/g, "")}`;
  }

  describeUrlHost(url) {
    try {
      return new URL(url).hostname.replace(/^www\./, "") || "the site";
    } catch (error) {
      ignoreExpectedMariaParseError(error);
      return "the site";
    }
  }

  escapeRegExp(value) {
    return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  cleanResearchQuery(command) {
    const text = this.normalizeAssistantText(command);
    const cleaned = text
      .replace(/^hey maria[:,\s]*/i, "")
      .replace(/^maria[:,\s]*/i, "")
      .replace(/^please\s+/i, "")
      .replace(/^(research|search|find|look up|summarize|explain)\s+/i, "")
      .replace(/^(for|about|on)\s+/i, "")
      .trim();

    return cleaned || text;
  }

  extractScreenshotBase64(screenshotDataUrl) {
    const value = this.normalizeAssistantText(screenshotDataUrl);
    if (!value) {
      return "";
    }

    const commaIndex = value.indexOf(",");
    return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
  }

  normalizeScreenshotsForChat(screenshots) {
    if (!Array.isArray(screenshots)) {
      return [];
    }

    return screenshots
      .map((screenshot, index) => {
        const image = this.extractScreenshotBase64(screenshot?.image || screenshot?.screenshot || screenshot);
        if (!image) {
          return null;
        }

        return {
          image,
          label: this.truncateForSpeech(screenshot?.label || `Screen ${index + 1}`, 140),
          isCursorScreen: screenshot?.isCursorScreen === true,
          width: Number(screenshot?.width) || Number(screenshot?.screenshotWidth) || Number(screenshot?.screenshotWidthInPixels) || undefined,
          height: Number(screenshot?.height) || Number(screenshot?.screenshotHeight) || Number(screenshot?.screenshotHeightInPixels) || undefined,
        };
      })
      .filter(Boolean);
  }

  classifyCommand(command) {
    const normalized = this.normalizeAssistantText(command).toLowerCase();

    if (!normalized) {
      return { type: "no_op", reason: "empty-command" };
    }

    if (this.isStopCommand(normalized)) {
      return { type: "no_op", reason: "stopped" };
    }

    if (this.isCalendarCommand(normalized)) {
      return {
        type: "calendar_check",
        command: this.normalizeAssistantText(command),
      };
    }

    if (this.isScreenAnalysisCommand(normalized)) {
      return { type: "screen_analysis", command: this.normalizeAssistantText(command) };
    }

    if (this.isBrowserAuthCommand(command)) {
      const browserAuthWorkflow = this.buildBrowserAuthWorkflowFromCommand(command);
      if (!browserAuthWorkflow) {
        return {
          type: "browser_auth_target_needed",
          message:
            "Which website or app should I open? I can help with the browser flow, but you should complete passwords, CAPTCHAs, and verification codes directly in the browser.",
        };
      }

      return {
        type: "desktop_workflow",
        command: this.normalizeAssistantText(command),
        ...browserAuthWorkflow,
      };
    }

    const desktopWorkflow = this.buildDesktopWorkflowFromCommand(command);
    if (desktopWorkflow) {
      return {
        type: "desktop_workflow",
        command: this.normalizeAssistantText(command),
        ...desktopWorkflow,
      };
    }

    if (this.isResearchCommand(normalized)) {
      return { type: "research", query: this.cleanResearchQuery(command) };
    }

    if (this.looksLikeUrl(normalized)) {
      return { type: "scrape", url: this.extractUrl(command) };
    }

    if (normalized.includes("voice") || normalized.includes("listen") || normalized.includes("wake word")) {
      return { type: "no_op", reason: "voice-trigger" };
    }

    return { type: "interaction", command: this.normalizeAssistantText(command) };
  }

  async callFirecrawl(endpointPath, body, options = {}) {
    const apiKey = this.getFirecrawlApiKey();

    if (!apiKey) {
      throw new Error("Firecrawl API key is not configured. Set FIRECRAWL_API_KEY.");
    }

    if (!fetchFn) {
      throw new Error("No fetch implementation available in this runtime. Install 'node-fetch' or run on Node/Electron with global fetch.");
    }

    const response = await fetchFn(`${FIRECRAWL_BASE_URL}${endpointPath}`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: options.signal,
    });

    const responseText = await response.text();

    if (!response.ok) {
      throw new Error(`Firecrawl ${endpointPath} failed with ${response.status}: ${responseText}`);
    }

    try {
      return JSON.parse(responseText);
    } catch (error) {
      throw new Error(`Firecrawl ${endpointPath} returned invalid JSON`);
    }
  }

  async callMariaChat(command, options = {}) {
    if (!fetchFn) {
      throw new Error("No fetch implementation available in this runtime. Install 'node-fetch' or run on Node/Electron with global fetch.");
    }

    const memories = await this.memoryStore.getPromptMemories();

    const response = await fetchFn(this.getMariaChatUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: this.normalizeAssistantText(command),
        history: this.getRecentConversationHistory(),
        memories,
        screenshot: this.extractScreenshotBase64(options.screenshotDataUrl || options.screenshot),
        screenshots: this.normalizeScreenshotsForChat(options.screenshots),
        mode: options.mode,
      }),
      signal: options.signal,
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch (error) {
      ignoreExpectedMariaParseError(error);
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.reply || payload?.error || `Maria chat failed with ${response.status}`;
      throw new Error(message);
    }

    const reply = this.normalizeAssistantText(payload?.reply);
    if (options.remember !== false && options.mode !== "action_plan" && !payload?.aiUnavailable) {
      this.rememberConversationTurn(options.historyUserCommand || command, reply);
    }

    return {
      payload,
      reply,
    };
  }

  summarizeResearchResults(searchResponse) {
    const results = Array.isArray(searchResponse?.data?.web) ? searchResponse.data.web : [];

    return results.slice(0, 3).map((result) => ({
      title: result?.metadata?.title || result?.title || "Untitled result",
      url: result?.url || result?.metadata?.url || result?.metadata?.sourceURL || "",
      description: result?.description || result?.metadata?.description || "",
      summary: result?.summary || result?.markdown || result?.description || "",
    }));
  }

  async researchWithFirecrawl(command, screenshotDataUrl, options = {}) {
    const query = this.cleanResearchQuery(command);
    this.notifyStatus("Researching with Firecrawl...");
    this.emitAssistantEvent({
      type: "research-started",
      query,
      hasScreenshotContext: Boolean(screenshotDataUrl),
    });

    const researchResponse = await this.callFirecrawl("/search", {
      query,
      limit: 5,
      sources: [{ type: "web" }],
      scrapeOptions: {
        formats: [{ type: "summary" }],
        onlyMainContent: true,
      },
    }, options);

    const results = this.summarizeResearchResults(researchResponse);
    const headline = results[0]?.title || query;

    const payload = {
      type: "research-completed",
      query,
      headline,
      results,
    };

    this.emitAssistantEvent(payload);
    if (results.length > 0) {
      const summary = results[0]?.summary || results[0]?.description || "";
      this.emitAssistantReply(
        `Research complete. Top result: ${headline}. ${summary}`,
        { source: "research", query }
      );
    } else {
      this.emitAssistantReply(
        `Research complete, but I did not find a strong result for ${query}.`,
        { source: "research", query }
      );
    }
    this.notifyStatus(`Research complete: ${headline}`);
    this.notifyStatus("Ready");
    return { ok: true, mode: "research", query, headline, results };
  }

  async scrapeUrlWithFirecrawl(url, options = {}) {
    this.notifyStatus("Scraping page with Firecrawl...");
    this.emitAssistantEvent({
      type: "scrape-started",
      url,
    });

    const scrapeResponse = await this.callFirecrawl("/scrape", {
      url,
      formats: [{ type: "summary" }, { type: "markdown" }, { type: "links" }],
      onlyMainContent: true,
      timeout: 60000,
    }, options);

    const data = scrapeResponse?.data || {};
    const summary = this.normalizeAssistantText(data.summary || data.markdown || data.metadata?.description || "Scrape completed.");
    const headline = this.normalizeAssistantText(data.metadata?.title || data.metadata?.url || url);

    const result = {
      title: headline,
      url: data.metadata?.url || url,
      summary,
      links: Array.isArray(data.links) ? data.links.slice(0, 10) : [],
    };

    this.emitAssistantEvent({
      type: "scrape-completed",
      url,
      result,
    });
    this.emitAssistantReply(`Scrape complete. ${headline}. ${summary}`, {
      source: "scrape",
      url,
    });

    this.notifyStatus(`Scrape complete: ${headline}`);
    this.notifyStatus("Ready");
    return { ok: true, mode: "scrape", result };
  }

  async planVisibleIssueAction(command, screenshotDataUrl, options = {}) {
    if (!screenshotDataUrl) {
      return {
        type: "no_action_plan",
        message: "I could not capture the screen, so I cannot safely plan a mouse action.",
      };
    }

    this.notifyStatus("Inspecting screen...");
    const { payload, reply } = await this.callMariaChat(command, {
      ...options,
      mode: "action_plan",
      screenshotDataUrl,
    });
    const actionPlan = this.normalizeVisibleActionPlan(payload?.actionPlan);

    if (payload?.aiUnavailable) {
      return {
        type: "no_action_plan",
        message: reply || "Screen action planning is unavailable because no vision model is configured.",
      };
    }

    if (!actionPlan || actionPlan.action !== "click") {
      return {
        type: "no_action_plan",
        message: actionPlan?.reason || reply || "I could not identify one safe mouse action from the visible screen.",
      };
    }

    if (actionPlan.risk === "high" || actionPlan.confidence < MIN_VISIBLE_ACTION_CONFIDENCE) {
      return {
        type: "no_action_plan",
        message:
          actionPlan.confidence < MIN_VISIBLE_ACTION_CONFIDENCE
            ? `I am not confident enough to click. ${actionPlan.reason}`
            : `I will not click because the suggested action looks high risk. ${actionPlan.reason}`,
      };
    }

    const bounds = options.screenshotDisplayBounds;
    const hasUsableBounds =
      bounds &&
      Number.isFinite(Number(bounds.x)) &&
      Number.isFinite(Number(bounds.y)) &&
      Number.isFinite(Number(bounds.width)) &&
      Number.isFinite(Number(bounds.height)) &&
      Number(bounds.width) > 0 &&
      Number(bounds.height) > 0;
    const screenSize = hasUsableBounds ? null : this.getScreenSizeForMousePlan();
    const x = hasUsableBounds
      ? Math.round(Number(bounds.x) + actionPlan.x * Number(bounds.width))
      : Math.min(screenSize.width - 1, Math.max(0, Math.round(actionPlan.x * screenSize.width)));
    const y = hasUsableBounds
      ? Math.round(Number(bounds.y) + actionPlan.y * Number(bounds.height))
      : Math.min(screenSize.height - 1, Math.max(0, Math.round(actionPlan.y * screenSize.height)));
    const summary = `${actionPlan.label} at ${x}, ${y}`;
    this.emitAssistantEvent({
      type: "screen-point",
      command: this.normalizeAssistantText(command),
      x,
      y,
      label: actionPlan.label,
      spokenText: actionPlan.reason,
      screenNumber: null,
    });

    return {
      type: "desktop_workflow",
      command: this.normalizeAssistantText(command),
      summary,
      workflow: this.buildSingleStepDesktopWorkflow(
        "visible_issue_click",
        actionPlan.label,
        actionPlan.reason,
        { type: "click", x, y, button: "left", double: false },
        10000
      ),
    };
  }

  // Plan an action given the command and optional screenshot. Returns a small
  // action object that executeAction understands.
  async planAction(command, screenshotDataUrl, options = {}) {
    const classified = this.classifyCommand(command);
    if (classified?.type !== "interaction" || !this.isScreenIssueAssistCommand(command)) {
      return classified;
    }

    return await this.planVisibleIssueAction(command, screenshotDataUrl, options);
  }

  async replyToInteraction(command, options = {}) {
    this.notifyStatus("Answering...");
    const { reply, payload } = await this.callMariaChat(command, options);
    const text = reply || "I heard you, but I do not have a useful reply yet.";

    this.emitAssistantReply(text, {
      source: "chat",
      command: this.normalizeAssistantText(command),
      aiUnavailable: Boolean(payload?.aiUnavailable),
      modelRoute: payload?.modelRoute,
    });

    return {
      ok: true,
      mode: "chat",
      reply: text,
      aiUnavailable: Boolean(payload?.aiUnavailable),
      modelRoute: payload?.modelRoute,
    };
  }

  async analyzeScreen(command, screenshotDataUrl, options = {}) {
    const normalizedCommand = this.normalizeAssistantText(command) || "Take a screenshot and tell me what you see.";
    const screenshots = Array.isArray(options.screenshots) ? options.screenshots : [];
    const hasScreenInput = Boolean(screenshotDataUrl) || screenshots.length > 0;

    if (!hasScreenInput) {
      const message = "I could not capture the screen from the desktop app.";
      this.emitAssistantEvent({
        type: "screen-analysis-failed",
        command: normalizedCommand,
        message,
      });
      this.emitAssistantReply(message, {
        source: "screen_analysis",
        command: normalizedCommand,
      });
      this.notifyStatus("Ready");
      return { ok: false, mode: "screen_analysis", reason: "screenshot-unavailable", message };
    }

    this.notifyStatus("Analyzing screen...");
    this.emitAssistantEvent({
      type: "screen-analysis-started",
      command: normalizedCommand,
      hasScreenshot: hasScreenInput,
    });

    const { reply, payload } = await this.callMariaChat(normalizedCommand, {
      ...options,
      screenshotDataUrl,
      screenshots,
    });
    const pointing = this.parsePointingCoordinates(reply || "");
    const text = pointing.spokenText || "I captured the screen, but I do not have a useful description yet.";
    this.emitPointingEvent(pointing, screenshots, normalizedCommand);

    this.emitAssistantEvent({
      type: "screen-analysis-completed",
      command: normalizedCommand,
      reply: text,
      modelRoute: payload?.modelRoute,
    });
    this.emitAssistantReply(text, {
      source: "screen_analysis",
      command: normalizedCommand,
      aiUnavailable: Boolean(payload?.aiUnavailable),
      modelRoute: payload?.modelRoute,
    });
    this.notifyStatus("Ready");

    return {
      ok: true,
      mode: "screen_analysis",
      reply: text,
      aiUnavailable: Boolean(payload?.aiUnavailable),
      modelRoute: payload?.modelRoute,
    };
  }

  buildCalendarOpenCandidates() {
    const configuredUrl = this.normalizeAssistantText(process.env.MARIA_CALENDAR_URL);
    const configuredProtocol = this.normalizeAssistantText(process.env.MARIA_CALENDAR_PROTOCOL);
    const candidates = [];

    if (configuredUrl) {
      candidates.push({ type: "external", target: configuredUrl });
    }

    if (process.platform === "win32") {
      candidates.push(
        { type: "external", target: configuredProtocol || "outlookcal:" },
        { type: "external", target: "ms-outlook://calendar" },
        { type: "spawn", command: this.normalizeAssistantText(process.env.MARIA_OUTLOOK_COMMAND) || "outlook.exe", args: ["/select", "outlook:calendar"] }
      );
    } else if (configuredProtocol) {
      candidates.push({ type: "external", target: configuredProtocol });
    }

    candidates.push(
      { type: "external", target: "https://outlook.office.com/calendar/" },
      { type: "external", target: "https://calendar.google.com/calendar/u/0/r" }
    );

    return candidates;
  }

  async launchCalendarCandidate(candidate) {
    if (candidate.type === "external") {
      await shell.openExternal(candidate.target);
      return candidate.target;
    }

    if (candidate.type === "spawn") {
      await new Promise((resolve, reject) => {
        const child = spawn(candidate.command, candidate.args || [], {
          detached: true,
          stdio: "ignore",
          windowsHide: process.platform === "win32",
        });

        child.once("error", reject);
        child.once("spawn", () => {
          try {
            child.unref();
          } catch (error) {
            log.debug("Ignored calendar launcher unref error:", error?.message || error);
          }
          resolve();
        });
      });

      return `${candidate.command} ${(candidate.args || []).join(" ")}`.trim();
    }

    throw new Error(`Unsupported calendar launch type: ${candidate.type}`);
  }

  async openLocalCalendar() {
    const errors = [];

    for (const candidate of this.buildCalendarOpenCandidates()) {
      try {
        return await this.launchCalendarCandidate(candidate);
      } catch (error) {
        errors.push(`${candidate.target || candidate.command}: ${error?.message || error}`);
      }
    }

    throw new Error(`Could not open a local calendar target. ${errors.join("; ")}`);
  }

  async checkCalendar(command, options = {}) {
    const normalizedCommand = this.normalizeAssistantText(command) || "Check my calendar.";
    this.notifyStatus("Opening calendar...");
    this.emitAssistantEvent({
      type: "calendar-check-started",
      command: normalizedCommand,
    });

    let openedTarget = "";
    try {
      openedTarget = await this.openLocalCalendar();
    } catch (error) {
      const message = "I could not open a local calendar app or browser calendar.";
      this.emitAssistantEvent({
        type: "calendar-check-failed",
        command: normalizedCommand,
        error: String(error),
        message,
      });
      this.emitAssistantReply(message, {
        source: "calendar_check",
        command: normalizedCommand,
        error: String(error),
      });
      this.notifyStatus("Ready");
      return { ok: false, mode: "calendar_check", reason: "open-failed", message, error: String(error) };
    }

    await this.delay(Number(process.env.MARIA_CALENDAR_OPEN_WAIT_MS || 3500), options.signal);
    this.throwIfStopped(options.signal);

    this.notifyStatus("Reading calendar...");
    const screenshot = await this.perceive({ preferDesktop: true });
    this.throwIfStopped(options.signal);

    if (!screenshot) {
      const message = "I opened the calendar, but I could not capture the screen to read it.";
      this.emitAssistantEvent({
        type: "calendar-check-failed",
        command: normalizedCommand,
        openedTarget,
        reason: "screenshot-unavailable",
        message,
      });
      this.emitAssistantReply(message, {
        source: "calendar_check",
        command: normalizedCommand,
      });
      this.notifyStatus("Ready");
      return { ok: false, mode: "calendar_check", reason: "screenshot-unavailable", message, openedTarget };
    }

    const calendarPrompt = [
      `The user asked: ${normalizedCommand}`,
      "The local calendar app or browser calendar should now be visible on the desktop.",
      "Summarize only the visible calendar events, times, dates, conflicts, empty slots, or sign-in/locked state.",
      "If no calendar content is visible, say that clearly. Do not infer private details that are not visible.",
    ].join(" ");

    try {
      const { reply, payload } = await this.callMariaChat(calendarPrompt, {
        ...options,
        screenshotDataUrl: screenshot,
        historyUserCommand: normalizedCommand,
      });
      const text = reply || "I opened the calendar, but I could not identify visible calendar items.";

      this.emitAssistantEvent({
        type: "calendar-check-completed",
        command: normalizedCommand,
        openedTarget,
        reply: text,
        modelRoute: payload?.modelRoute,
      });
      this.emitAssistantReply(text, {
        source: "calendar_check",
        command: normalizedCommand,
        aiUnavailable: Boolean(payload?.aiUnavailable),
        modelRoute: payload?.modelRoute,
      });
      this.notifyStatus("Ready");

      return {
        ok: true,
        mode: "calendar_check",
        reply: text,
        message: text,
        openedTarget,
        aiUnavailable: Boolean(payload?.aiUnavailable),
        modelRoute: payload?.modelRoute,
      };
    } catch (error) {
      const message = "I opened the calendar, but I could not summarize the visible screen right now.";
      this.emitAssistantEvent({
        type: "calendar-check-failed",
        command: normalizedCommand,
        openedTarget,
        error: String(error),
        message,
      });
      this.emitAssistantReply(message, {
        source: "calendar_check",
        command: normalizedCommand,
        error: String(error),
      });
      this.notifyStatus("Ready");
      return { ok: false, mode: "calendar_check", reason: "vision-failed", message, openedTarget, error: String(error) };
    }
  }

  getDesktopWorkflowExecutor() {
    const existingExecutor = getExecutor?.();
    if (existingExecutor) {
      existingExecutor.setMainWindow?.(this.mainWindow);
      return existingExecutor;
    }

    if (!this.mariaWorkflowExecutor) {
      this.mariaWorkflowExecutor = new WorkflowExecutor({
        mainWindow: this.mainWindow,
        userId: "maria",
      });
    } else {
      this.mariaWorkflowExecutor.setMainWindow?.(this.mainWindow);
    }

    return this.mariaWorkflowExecutor;
  }

  getExistingDesktopWorkflowExecutor() {
    return getExecutor?.() || this.mariaWorkflowExecutor;
  }

  async waitForWorkflowCompletion(executor, workflowId, options = {}) {
    const finalStates = new Set(["completed", "failed", "stopped", "rejected"]);
    const timeoutMs = Number(options.timeoutMs || 180000);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutMs) {
      this.throwIfStopped(options.signal);

      const state = executor.getState?.();
      if (state?.workflowId === workflowId && finalStates.has(state.state)) {
        return state;
      }

      const history = executor.getHistory?.(workflowId);
      const archived = Array.isArray(history) ? history.find((item) => item?.workflowId === workflowId) : null;
      if (archived && finalStates.has(archived.state)) {
        return archived;
      }

      await this.delay(250, options.signal);
    }

    throw new Error(`Desktop workflow timed out: ${workflowId}`);
  }

  summarizeWorkflowResult(action, state) {
    const logs = Array.isArray(state?.logs) ? state.logs : [];
    const lastLog = [...logs].reverse().find((log) => log?.status === "success") || logs[logs.length - 1];
    const result = lastLog?.result;

    if (action?.workflow?.id === "open_terminal") {
      const target = this.normalizeAssistantText(action.summary).replace(/^open\s+/i, "") || "Terminal";
      return `${target} opened and verified.`;
    }

    if (result && typeof result === "object") {
      const stdout = this.normalizeAssistantText(result.stdout);
      const stderr = this.normalizeAssistantText(result.stderr);
      const output = stdout || stderr;
      if (output) {
        return this.truncateForSpeech(`Command completed. ${output}`, 600);
      }
      if (Object.prototype.hasOwnProperty.call(result, "exitCode")) {
        return `Command completed with exit code ${result.exitCode}.`;
      }
    }

    if (typeof result === "string" && result.trim()) {
      if (/read file/i.test(action?.summary || "")) {
        return this.truncateForSpeech(`File content: ${result}`, 600);
      }
      return this.truncateForSpeech(result, 600);
    }

    return `${action.summary || "Desktop workflow"} completed.`;
  }

  async runDesktopWorkflowAction(action, options = {}) {
    if (!action?.workflow) {
      throw new Error("Desktop workflow action is missing a workflow payload.");
    }

    const executor = this.getDesktopWorkflowExecutor();
    const workflow = {
      ...action.workflow,
      source: "template",
      requiresApproval: false,
    };

    this.notifyStatus("Running desktop workflow...");
    this.emitAssistantEvent({
      type: "desktop-workflow-started",
      command: this.normalizeAssistantText(action.command),
      workflowId: workflow.id,
      summary: action.summary,
    });

    const startResult = await executor.startWorkflow(workflow);
    if (!startResult?.success) {
      throw new Error(startResult?.error || "Desktop workflow could not start.");
    }

    try {
      const finalState = await this.waitForWorkflowCompletion(executor, workflow.id, {
        signal: options.signal,
        timeoutMs: action.timeoutMs || 180000,
      });

      if (finalState.state !== "completed") {
        const message = finalState.error || `Desktop workflow ${finalState.state}.`;
        this.emitAssistantEvent({
          type: "desktop-workflow-failed",
          command: this.normalizeAssistantText(action.command),
          workflowId: workflow.id,
          state: finalState.state,
          message,
        });
        this.emitAssistantReply(message, {
          source: "desktop_workflow",
          command: this.normalizeAssistantText(action.command),
        });
        this.notifyStatus("Ready");
        return { ok: false, mode: "desktop_workflow", workflowId: workflow.id, state: finalState.state, message };
      }

      const reply = this.summarizeWorkflowResult(action, finalState);
      this.emitAssistantEvent({
        type: "desktop-workflow-completed",
        command: this.normalizeAssistantText(action.command),
        workflowId: workflow.id,
        state: finalState.state,
        reply,
      });
      this.emitAssistantReply(reply, {
        source: "desktop_workflow",
        command: this.normalizeAssistantText(action.command),
      });
      this.notifyStatus("Ready");
      return { ok: true, mode: "desktop_workflow", workflowId: workflow.id, state: finalState.state, reply, message: reply };
    } catch (error) {
      if (options.signal?.aborted || this.isAbortError(error)) {
        executor.stop?.();
      }
      throw error;
    }
  }

  async handleMemoryCommand(command) {
    const saveIntent = this.memoryStore.extractSaveIntent(command);

    if (saveIntent?.blocked) {
      const message = saveIntent.message || "I cannot store that in Maria memory.";
      this.emitAssistantEvent({
        type: "memory-blocked",
        command: this.normalizeAssistantText(command),
        reason: saveIntent.reason || "blocked",
        message,
      });
      this.emitAssistantReply(message, {
        source: "memory",
        command: this.normalizeAssistantText(command),
      });
      return { ok: false, mode: "memory", reason: saveIntent.reason || "blocked", message };
    }

    if (saveIntent?.memory) {
      const saved = await this.memoryStore.saveMemory(saveIntent.memory);
      const content = this.truncateForSpeech(saved.memory?.content || saveIntent.memory.content, 180);
      const message = `Got it. I'll remember: ${content}`;

      this.emitAssistantEvent({
        type: "memory-saved",
        command: this.normalizeAssistantText(command),
        memory: {
          key: saved.memory?.key,
          label: saved.memory?.label,
          kind: saved.memory?.kind,
          content,
        },
      });
      this.emitAssistantReply(message, {
        source: "memory",
        command: this.normalizeAssistantText(command),
      });
      return {
        ok: true,
        mode: "memory",
        message,
        reply: message,
        memory: {
          key: saved.memory?.key,
          label: saved.memory?.label,
          kind: saved.memory?.kind,
          content,
        },
      };
    }

    const memoryAnswer = await this.memoryStore.answerMemoryQuery(command);
    if (memoryAnswer) {
      this.emitAssistantEvent({
        type: "memory-read",
        command: this.normalizeAssistantText(command),
        found: Boolean(memoryAnswer.found),
      });
      this.emitAssistantReply(memoryAnswer.reply, {
        source: "memory",
        command: this.normalizeAssistantText(command),
      });
      return {
        ok: true,
        mode: "memory",
        found: Boolean(memoryAnswer.found),
        message: memoryAnswer.reply,
        reply: memoryAnswer.reply,
      };
    }

    return null;
  }

  // Execute a planned action. Keep each action small and explicit.
  async executeAction(action, options = {}) {
    if (!action || action.type === "no_op") return;

    this.throwIfStopped(options.signal);

    switch (action.type) {
      case "navigate_and_click":
        if (!robotAvailable) {
          throw new Error("Mouse actions are disabled: native module 'robotjs' not available");
        }

        await this.smoothMove(action.x, action.y, options);
        this.throwIfStopped(options.signal);
        robot.mouseClick();
        await this.delay(300, options.signal);
        this.throwIfStopped(options.signal);
        if (action.text) {
          robot.typeString(action.text);
          await this.delay(50, options.signal);
          this.throwIfStopped(options.signal);
          robot.keyTap("enter");
        }
        break;

      case "type_and_enter":
        if (!robotAvailable) {
          throw new Error("Mouse actions are disabled: native module 'robotjs' not available");
        }

        await this.smoothMove(action.x, action.y, options);
        this.throwIfStopped(options.signal);
        robot.mouseClick();
        await this.delay(100, options.signal);
        this.throwIfStopped(options.signal);
        if (action.text) {
          robot.typeString(action.text);
          await this.delay(50, options.signal);
          this.throwIfStopped(options.signal);
          robot.keyTap("enter");
        }
        break;

      default:
        log.warn("Unknown action type:", action.type);
    }
  }

  async smoothMove(targetX, targetY, options = {}) {
    if (!robotAvailable) return;

    this.throwIfStopped(options.signal);
    const start = robot.getMousePos();
    // Configurable smoothing: duration in ms and steps
    const duration = parseInt(process.env.MARIA_SMOOTH_MOVE_MS || "400", 10);
    const steps = parseInt(process.env.MARIA_SMOOTH_MOVE_STEPS || "60", 10);
    const delay = Math.max(4, Math.floor(duration / Math.max(1, steps)));

    // Cubic ease-out for a natural feel
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    for (let i = 0; i <= steps; i++) {
      this.throwIfStopped(options.signal);
      const t = i / steps;
      const eased = easeOutCubic(t);
      const x = start.x + (targetX - start.x) * eased;
      const y = start.y + (targetY - start.y) * eased;
      try {
        robot.moveMouse(Math.round(x), Math.round(y));
      } catch (e) {
        // ignore transient native errors during movement
      }
      await this.delay(delay, options.signal);
    }
  }

  delay(ms, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        const error = new Error("Maria request stopped.");
        error.name = "AbortError";
        reject(error);
        return;
      }

      const handleAbort = () => {
        clearTimeout(timeoutId);
        const error = new Error("Maria request stopped.");
        error.name = "AbortError";
        reject(error);
      };

      const timeoutId = setTimeout(() => {
        signal?.removeEventListener?.("abort", handleAbort);
        resolve();
      }, ms);

      signal?.addEventListener?.("abort", handleAbort, { once: true });
    });
  }

  notifyStatus(status) {
    if (this.mariaWindow && !this.mariaWindow.isDestroyed()) {
      this.mariaWindow.webContents.send("maria:status", status);
    }
  }

  /*
   * Telephony & Meeting helper stubs
   * These are small, safe stubs that contact the local desktop API surface
   * added in `desktop-app/api-routes/calls.cjs`. They emit assistant events
   * so the renderer can show call/meeting status. Implement provider
   * wiring (Twilio/Zoom SDK) in the calls route and handler later.
   */
  async initiateCall({ to, from, provider = "twilio", direction = "outbound" } = {}) {
    const port = process.env.REARVY_LOCAL_API_PORT || 4000;
    const base = `http://127.0.0.1:${port}`;
    try {
      const response = await fetchFn(`${base}/api/calls/initiate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ to, from, provider, direction }),
      });
      const data = response && typeof response.json === "function" ? await response.json() : null;
      if (!response?.ok || data?.ok === false || data?.error) {
        throw new Error(data?.error || `Call API failed with status ${response?.status || "unknown"}`);
      }

      this.emitAssistantEvent({ type: "call-initiated", to, provider, session: data?.sessionId || null });
      return { ok: true, data };
    } catch (err) {
      log.warn("initiateCall failed:", err?.message || err);
      this.emitAssistantEvent({ type: "call-error", message: String(err?.message || err) });
      return { ok: false, error: String(err?.message || err) };
    }
  }

  async getCallStatus(sessionId) {
    const port = process.env.REARVY_LOCAL_API_PORT || 4000;
    const base = `http://127.0.0.1:${port}`;
    try {
      const response = await fetchFn(`${base}/api/calls/status/${encodeURIComponent(sessionId)}`);
      const data = response && typeof response.json === "function" ? await response.json() : null;
      this.emitAssistantEvent({ type: "call-status", sessionId, status: data?.state || "unknown" });
      return { ok: true, data };
    } catch (err) {
      log.warn("getCallStatus failed:", err?.message || err);
      return { ok: false, error: String(err?.message || err) };
    }
  }

  async joinMeeting(meetingInfo = {}) {
    // meetingInfo may include { meetingId, passcode, displayName, provider }
    try {
      const provider = meetingInfo.provider || "zoom";
      // For now reuse initiate endpoint; provider handler should special-case meetings
      const result = await this.initiateCall({ to: meetingInfo.meetingId || meetingInfo.url, provider, direction: "join" });
      this.emitAssistantEvent({ type: "meeting-joined", meetingInfo, result });
      return result;
    } catch (err) {
      log.warn("joinMeeting failed:", err?.message || err);
      this.emitAssistantEvent({ type: "meeting-error", message: String(err?.message || err) });
      return { ok: false, error: String(err?.message || err) };
    }
  }

  async escalateToManager({ assistantId, reason } = {}) {
    this.emitAssistantEvent({ type: "escalation-request", assistantId, reason });

    const managerContact = String(process.env.REARVY_MANAGER_CONTACT || process.env.REARVY_MANAGER_PHONE || "").trim();
    if (!managerContact) {
      const message = "Escalation requested, but no manager contact is configured.";
      this.emitAssistantEvent({
        type: "escalation-unconfigured",
        assistantId,
        reason,
        message,
      });
      return { ok: true, escalated: false, reason: "manager-contact-not-configured", message };
    }

    const provider = String(process.env.REARVY_MANAGER_CALL_PROVIDER || "twilio").trim() || "twilio";
    const result = await this.initiateCall({ to: managerContact, provider, direction: "outbound" });
    const escalated = result.ok === true;
    const message = escalated
      ? "Escalation call started."
      : result.error || "Escalation requested, but the call could not be started.";

    this.emitAssistantEvent({
      type: escalated ? "escalation-started" : "escalation-error",
      assistantId,
      reason,
      provider,
      message,
    });

    return { ok: escalated, escalated, provider, message, result };
  }

  // Public entrypoint used by the preload bridge via IPC.
  async executeCommand(commandInput) {
    const commandPayload = this.normalizeCommandPayload(commandInput);
    const command = commandPayload.command;

    log.debug("executeCommand:", command);
    if (this.isThinking) {
      if (this.isStopCommand(command)) {
        return this.stop("user-stopped");
      }

      const message = "I am still working on the last request. Please try again in a moment.";
      log.debug("busy - ignoring command");
      this.emitAssistantReply(message, {
        source: "busy",
        command: this.normalizeAssistantText(command),
        requestId: commandPayload.requestId,
        origin: commandPayload.origin,
      });
      return { ok: false, reason: "busy", message };
    }

    const abortController = new AbortController();
    this.isThinking = true;
    this.activeAbortController = abortController;
    this.activeReplyMetadata = {
      requestId: commandPayload.requestId,
      origin: commandPayload.origin,
    };
    this.notifyStatus("Thinking...");
    this.emitAssistantEvent({ type: "command-started", command: this.normalizeAssistantText(command) });

    try {
      const activeCommand = command;

      const memoryResponse = await this.handleMemoryCommand(command);
      this.throwIfStopped(abortController.signal);
      if (memoryResponse) {
        this.notifyStatus("Ready");
        return memoryResponse;
      }

      const normalizedCommand = this.normalizeAssistantText(command).toLowerCase();
      const needsScreenContext =
        this.isScreenAnalysisCommand(normalizedCommand) ||
        this.isScreenIssueAssistCommand(command);
      this.throwIfStopped(abortController.signal);
      const screenContext = needsScreenContext
        ? await this.perceiveScreenContext({ preferDesktop: true })
        : null;
      const screenshot = screenContext?.primaryDataUrl || await this.perceive({
        preferDesktop: this.isScreenAnalysisCommand(normalizedCommand),
      });
      this.throwIfStopped(abortController.signal);

      const localDesktopCandidate =
        this.isCalendarCommand(normalizedCommand) ||
        this.buildDesktopWorkflowFromCommand(command);
      if (this.isSensitiveDisclosureRequest(command) && !localDesktopCandidate) {
        const message = "I'm Maria, the Rearvy assistant. I can't share private files, credentials, or internal business data through this flow.";
        this.notifyStatus("Ready");
        this.emitAssistantEvent({
          type: "policy-response",
          command: this.normalizeAssistantText(command),
          message,
        });
        this.emitAssistantEvent({
          type: "command-blocked",
          command: this.normalizeAssistantText(command),
          reason: "sensitive-disclosure",
          message,
        });
        this.emitAssistantReply(message, {
          source: "policy",
          command: this.normalizeAssistantText(command),
        });
        return { ok: false, reason: "sensitive-disclosure", message };
      }

      const plan = await this.planAction(command, screenshot, {
        signal: abortController.signal,
        screenshotDisplayBounds: screenContext?.primary?.bounds || null,
      });
      this.throwIfStopped(abortController.signal);

      const replanned = plan;
      this.throwIfStopped(abortController.signal);

      if (replanned?.type === "browser_auth_target_needed") {
        const message =
          replanned.message ||
          "Which website or app should I open for the browser sign-in flow?";
        this.emitAssistantReply(message, {
          source: "browser_auth",
          command: this.normalizeAssistantText(activeCommand),
        });
        this.notifyStatus("Ready");
        return { ok: true, reason: "missing-browser-auth-target", message };
      }

      if (replanned?.type === "screen_analysis") {
        return await this.analyzeScreen(activeCommand, screenshot, {
          signal: abortController.signal,
          screenshots: screenContext?.screenshots || [],
        });
      }

      if (replanned?.type === "calendar_check") {
        return await this.checkCalendar(activeCommand, { signal: abortController.signal });
      }

      if (replanned?.type === "desktop_workflow") {
        return await this.runDesktopWorkflowAction(replanned, { signal: abortController.signal });
      }

      if (replanned?.type === "no_action_plan") {
        const message = replanned.message || "I could not identify one safe mouse action from the visible screen.";
        this.emitAssistantReply(message, {
          source: "screen_action_plan",
          command: this.normalizeAssistantText(activeCommand),
        });
        this.notifyStatus("Ready");
        return { ok: true, reason: "no-action-plan", message };
      }

      if (replanned?.type === "research") {
        return await this.researchWithFirecrawl(command, screenshot, { signal: abortController.signal });
      }

      if (replanned?.type === "scrape") {
        if (!replanned.url) {
          throw new Error("Could not determine a URL to scrape.");
        }

        return await this.scrapeUrlWithFirecrawl(replanned.url, { signal: abortController.signal });
      }

      if (replanned?.type === "interaction") {
        const response = await this.replyToInteraction(activeCommand, {
          signal: abortController.signal,
        });
        this.notifyStatus("Ready");
        return response;
      }

      if (replanned?.type === "no_op") {
        const message =
          replanned.reason === "voice-trigger"
            ? "I'm listening. Say Hey Maria followed by what you need."
            : replanned.reason === "stopped"
              ? "Maria stopped."
            : "I need a command before I can respond.";
        this.emitAssistantReply(message, {
          source: "no-op",
          command: this.normalizeAssistantText(activeCommand),
        });
        this.notifyStatus("Ready");
        return { ok: true, reason: replanned.reason, message };
      }

      this.notifyStatus(replanned?.reason || "Executing...");
      await this.executeAction(replanned, { signal: abortController.signal });
      this.throwIfStopped(abortController.signal);

      const completedMessage = "Done.";
      this.emitAssistantEvent({
        type: "command-completed",
        command: this.normalizeAssistantText(activeCommand),
        mode: replanned?.type || "interaction",
      });
      this.emitAssistantReply(completedMessage, {
        source: "command",
        command: this.normalizeAssistantText(activeCommand),
      });
      this.notifyStatus("Ready");
      return { ok: true, message: completedMessage };
    } catch (err) {
      if (abortController.signal.aborted || this.isAbortError(err)) {
        return { ok: true, reason: "stopped", message: "Maria stopped." };
      }

      log.error("Execution failed:", err);
      const message = "I could not complete that request. Please check Maria setup and try again.";
      this.emitAssistantEvent({
        type: "command-failed",
        command: this.normalizeAssistantText(command),
        error: String(err),
      });
      this.emitAssistantReply(message, {
        source: "error",
        command: this.normalizeAssistantText(command),
        error: String(err),
      });
      this.notifyStatus("Error occurred");
      return { ok: false, error: String(err), message };
    } finally {
      if (this.activeAbortController === abortController) {
        this.isThinking = false;
        this.activeAbortController = null;
        this.activeReplyMetadata = {};
      }
    }
  }

  async research(commandInput) {
    const commandPayload = this.normalizeCommandPayload(commandInput);
    const command = commandPayload.command;

    if (this.isThinking) {
      if (this.isStopCommand(command)) {
        return this.stop("user-stopped");
      }

      const message = "I am still working on the last request. Please try again in a moment.";
      this.emitAssistantReply(message, {
        source: "busy",
        command: this.normalizeAssistantText(command),
        requestId: commandPayload.requestId,
        origin: commandPayload.origin,
      });
      return { ok: false, reason: "busy", message };
    }

    const abortController = new AbortController();
    this.isThinking = true;
    this.activeAbortController = abortController;
    this.activeReplyMetadata = {
      requestId: commandPayload.requestId,
      origin: commandPayload.origin,
    };

    try {
      const normalizedCommand = this.normalizeAssistantText(command).toLowerCase();
      if (this.isScreenAnalysisCommand(normalizedCommand)) {
        const screenContext = await this.perceiveScreenContext({ preferDesktop: true });
        const screenshot = screenContext.primaryDataUrl;
        this.throwIfStopped(abortController.signal);
        return await this.analyzeScreen(command, screenshot, {
          signal: abortController.signal,
          screenshots: screenContext.screenshots,
        });
      }

      const screenshot = await this.perceive();
      this.throwIfStopped(abortController.signal);
      return await this.researchWithFirecrawl(command, screenshot, {
        signal: abortController.signal,
      });
    } catch (err) {
      if (abortController.signal.aborted || this.isAbortError(err)) {
        return { ok: true, reason: "stopped", message: "Maria stopped." };
      }

      const message = "I could not finish that research request. Please check Maria setup and try again.";
      log.error("Research failed:", err);
      this.emitAssistantEvent({
        type: "command-failed",
        command: this.normalizeAssistantText(command),
        error: String(err),
      });
      this.emitAssistantReply(message, {
        source: "error",
        command: this.normalizeAssistantText(command),
        error: String(err),
      });
      this.notifyStatus("Error occurred");
      return { ok: false, error: String(err), message };
    } finally {
      if (this.activeAbortController === abortController) {
        this.isThinking = false;
        this.activeAbortController = null;
        this.activeReplyMetadata = {};
      }
    }
  }

  ignoreExpectedStopError(context, error) {
    log.debug(`Ignored stop cleanup error while ${context}:`, error?.message || error);
  }

  stop(reason = "user-stopped") {
    const wasThinking = this.isThinking;

    try {
      this.activeAbortController?.abort();
    } catch (error) {
      this.ignoreExpectedStopError("aborting the active request", error);
    }

    try {
      this.getExistingDesktopWorkflowExecutor()?.stop?.();
    } catch (error) {
      this.ignoreExpectedStopError("stopping the desktop workflow", error);
    }

    this.activeAbortController = null;
    this.isThinking = false;
    this.activeReplyMetadata = {};

    const message = wasThinking ? "Maria stopped." : "Maria is already ready.";
    this.emitAssistantEvent({
      type: "command-stopped",
      reason,
      message,
    });
    this.notifyStatus("Ready");

    return { ok: true, stopped: wasThinking, reason, message };
  }
}

function setupMariaLogic(mainWindow, mariaWindow, appUrl) {
  const brain = new MariaBrain(mainWindow, mariaWindow, appUrl);

  ipcMain.handle("maria:command", async (_event, command) => {
    return await brain.executeCommand(command);
  });

  // Call control IPC handlers
  ipcMain.handle("maria:call:initiate", async (_event, params) => {
    return await brain.initiateCall(params || {});
  });

  ipcMain.handle("maria:call:status", async (_event, sessionId) => {
    return await brain.getCallStatus(sessionId);
  });

  ipcMain.handle("maria:call:stop", async (_event, sessionId) => {
    // No server-side stop route yet; emit event and return placeholder
    brain.emitAssistantEvent({ type: "call-stopped", sessionId });
    return { ok: true, stopped: true };
  });

  ipcMain.handle("maria:meeting:join", async (_event, meetingInfo) => {
    return await brain.joinMeeting(meetingInfo || {});
  });

  ipcMain.handle("maria:escalate", async (_event, payload) => {
    return await brain.escalateToManager(payload || {});
  });

  ipcMain.handle("maria:research", async (_event, command) => {
    return await brain.research(command);
  });

  ipcMain.handle("maria:stop", async () => {
    return brain.stop("user-stopped");
  });

  return brain;
}

module.exports = { setupMariaLogic };
