const { ipcMain, shell } = require("electron");
const { spawn } = require("child_process");
const { ClickyMemoryStore } = require("./lib/clicky-memory.cjs");
const { WorkflowExecutor } = require("./lib/workflow-executor.cjs");
const { isScreenReadIntent } = require("./lib/screen-intent.cjs");
const { getExecutor } = require("./automation-integration.cjs");
let robot = null;
let robotAvailable = false;
try {
  // robotjs is a native dependency that may not be available on all
  // platforms or in development environments. Require it lazily
  // and fall back to a graceful no-op implementation when missing.
  robot = require("robotjs");
  robotAvailable = true;
} catch (err) {
  console.warn("[Clicky] robotjs not available — mouse simulation disabled:", err?.message || err);
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
const CLICKY_CHAT_PATH = "/api/clicky/chat";
const FIRECRAWL_RESEARCH_KEYWORDS = ["research", "find", "look up", "search", "what's on", "what is on", "summarize", "explain"];
const APPROVAL_YES_COMMANDS = new Set(["continue", "proceed", "yes", "y", "yeah", "yep", "ok", "okay", "approve", "approved", "check", "do it", "go ahead"]);
const APPROVAL_NO_COMMANDS = new Set(["no", "n", "nope", "cancel", "stop", "never mind", "nevermind"]);
const DESKTOP_WORKFLOW_COMMAND_PATTERNS = [
  /^(?:run|execute)\s+(?:a\s+)?(?:terminal\s+)?(?:command|shell|powershell)\s*:?\s+(.+)$/i,
  /^(?:terminal|shell|powershell)\s*:?\s+(.+)$/i,
  /^(?:take|capture|get)\s+(?:a\s+)?(?:(?:desktop|screen)\s+)?screenshot$/i,
  /^screenshot$/i,
  /^(?:open|launch|start)\s+(.+)$/i,
  /^(?:read|show)\s+(?:the\s+)?(?:file|text file)\s+(.+)$/i,
  /^(?:reveal|show)\s+(.+?)\s+(?:in\s+)?(?:file explorer|explorer|folder)$/i,
  /^(?:write|save)\s+(.+?)\s+to\s+(?:file\s+)?(.+)$/i,
  /^(?:move\s+(?:the\s+)?mouse\s+(?:to\s+)?|mouse\s+to\s+)-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?$/i,
  /^(?:(?:left|right|double)\s+)?click(?:\s+(?:at|on))?\s+-?\d+(?:\.\d+)?\s*,?\s*-?\d+(?:\.\d+)?$/i,
  /^(?:type|enter\s+text)\s+(.+)$/i,
  /^(?:press|hit)\s+(.+)$/i,
  /^(?:copy|set)\s+(?:the\s+)?clipboard\s+(?:to|as)\s+(.+)$/i,
  /^copy\s+(.+)\s+to\s+(?:the\s+)?clipboard$/i,
  /^(?:read|show|get)\s+(?:the\s+)?clipboard$/i,
  /^scroll\s+(?:up|down|left|right)(?:\s+\d+)?$/i,
  /^close\s+(?:the\s+)?(?:active\s+)?window$/i,
];
const DECISION_KEYWORDS = ["employee", "salary", "payroll", "payment", "payments", "compensation", "invoice", "bill", "payout", "pay", "leave"];
const WORKBOOK_HINT_KEYWORDS = ["excel", "sheet", "sheets", "workbook", "spreadsheet", "tab", "tabs", "row", "rows"];
const OWNERSHIP_HINT_KEYWORDS = ["owner", "boss", "manager", "admin", "approval", "approve", "permission", "confirm"];
const SENSITIVE_DISCLOSURE_PATTERNS = [
  /\b(send|share|give|show|export|download|leak)\b.*\b(files?|documents?|docs?|business files?|private files?|credentials?|passwords?|keys?|secrets?|data)\b/i,
  /\b(business|private|confidential|internal)\b.*\b(files?|documents?|docs?|data|info|information)\b/i,
  /\b(access|open|read)\b.*\b(my|your|the)\b.*\b(files?|drive|folder|email|emails|inbox|account)\b/i,
];

/**
 * Clicky Logic - The Brain of the Mouse Assistant
 *
 * This file refactors the previous monolithic execute flow into a small
 * perception -> planning -> execution pipeline. The public IPC surface
 * (`clicky:command`, `clicky:status`) is preserved so the UI/preload
 * bridge does not need to change.
 */
class ClickyBrain {
  constructor(mainWindow, clickyWindow, appUrl) {
    this.mainWindow = mainWindow;
    this.clickyWindow = clickyWindow;
    this.appUrl = appUrl;
    this.isThinking = false;
    this.activeAbortController = null;
    this.latestAssistantEvent = null;
    this.pendingDecision = null;
    this.activeReplyMetadata = {};
    this.clickyWorkflowExecutor = null;
    this.memoryStore = new ClickyMemoryStore();
  }

  async captureMainWindow() {
    if (!this.mainWindow || !this.mainWindow.webContents || typeof this.mainWindow.webContents.capturePage !== "function") {
      return null;
    }

    const image = await this.mainWindow.webContents.capturePage();
    return image && typeof image.toDataURL === "function" ? image.toDataURL() : null;
  }

  async captureDesktopScreen() {
    const { desktopCapturer } = require("electron");
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1920, height: 1080 },
      fetchWindowIcons: false,
    });
    return sources && sources.length > 0 ? sources[0].thumbnail.toDataURL() : null;
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
          console.warn("[Clicky] desktop capture failed, falling back to capturePage:", err?.message || err);
        }
      }

      // Prefer using the main window's capturePage API when available.
      try {
        const pageImage = await this.captureMainWindow();
        if (pageImage) return pageImage;
      } catch (err) {
        console.warn("[Clicky] capturePage failed, falling back to desktopCapturer:", err?.message || err);
      }

      if (!preferDesktop) {
        return await this.captureDesktopScreen();
      }
    } catch (err) {
      // Non-fatal: perception may not be available on all platforms or dev environments
      console.warn("[Clicky] perceive() failed:", err?.message || err);
    }
    return null;
  }

  getFirecrawlApiKey() {
    return process.env.FIRECRAWL_API_KEY || process.env.REARVY_FIRECRAWL_API_KEY || "";
  }

  getClickyChatUrl() {
    const baseUrl =
      this.appUrl ||
      process.env.REARVY_DESKTOP_APP_URL ||
      process.env.REARVY_DESKTOP_DEV_URL ||
      "http://localhost:3000";

    return new URL(CLICKY_CHAT_PATH, baseUrl).toString();
  }

  emitAssistantEvent(event) {
    this.latestAssistantEvent = event;

    if (this.clickyWindow && !this.clickyWindow.isDestroyed()) {
      this.clickyWindow.webContents.send("clicky:assistant-event", event);
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("clicky:assistant-event", event);
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

    const error = new Error("Clicky request stopped.");
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

  isResearchCommand(normalizedCommand) {
    return FIRECRAWL_RESEARCH_KEYWORDS.some((keyword) => normalizedCommand.includes(keyword));
  }

  isScreenAnalysisCommand(normalizedCommand) {
    return isScreenReadIntent(normalizedCommand);
  }

  looksLikeUrl(normalizedCommand) {
    return /https?:\/\//i.test(normalizedCommand) || /^www\./i.test(normalizedCommand);
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

  isApprovalYesCommand(normalizedCommand) {
    return APPROVAL_YES_COMMANDS.has(this.normalizeAssistantText(normalizedCommand).toLowerCase());
  }

  isApprovalNoCommand(normalizedCommand) {
    return APPROVAL_NO_COMMANDS.has(this.normalizeAssistantText(normalizedCommand).toLowerCase());
  }

  hasKeyword(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
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
    const text = this.normalizeAssistantText(command);
    return DESKTOP_WORKFLOW_COMMAND_PATTERNS.some((pattern) => pattern.test(text));
  }

  buildDesktopWorkflow(idSuffix, name, description, steps) {
    return {
      id: `clicky_${idSuffix}_${Date.now()}`,
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

  normalizeOpenTarget(target) {
    const text = this.stripWrappingQuotes(target);
    if (/^www\./i.test(text)) {
      return `https://${text}`;
    }

    return text;
  }

  getAppAlias(target) {
    const normalized = this.normalizeAssistantText(target).toLowerCase();
    const aliases = {
      calculator: "calc.exe",
      calc: "calc.exe",
      notepad: "notepad.exe",
      paint: "mspaint.exe",
      explorer: "explorer.exe",
      "file explorer": "explorer.exe",
      terminal: "wt.exe",
      powershell: "powershell.exe",
      outlook: "outlook.exe",
    };

    return aliases[normalized] || null;
  }

  buildOpenTargetAction(target) {
    const normalizedTarget = this.normalizeOpenTarget(target);
    const appAlias = this.getAppAlias(normalizedTarget);

    if (appAlias) {
      return { type: "launchApp", appPath: appAlias };
    }

    if (this.looksLikeUrl(normalizedTarget.toLowerCase()) || this.looksLikeFilePath(normalizedTarget) || /^[a-zA-Z][a-zA-Z0-9+.-]{2,}:/.test(normalizedTarget)) {
      return { type: "openPath", target: normalizedTarget };
    }

    return { type: "launchApp", appPath: normalizedTarget };
  }

  buildDesktopWorkflowFromCommand(command) {
    const text = this.normalizeAssistantText(command);
    if (!text) {
      return null;
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

  buildDecisionContext(command) {
    const text = this.normalizeAssistantText(command);
    const lower = text.toLowerCase();
    const hasDecisionWords = /\b(should i|should we|do i|do we|can i|can we|proceed|continue|approve|confirm|ask|check|verify)\b/i.test(text);
    const hasPaymentWords = this.hasKeyword(lower, DECISION_KEYWORDS);
    const hasWorkbookWords = this.hasKeyword(lower, WORKBOOK_HINT_KEYWORDS);
    const hasOwnershipWords = this.hasKeyword(lower, OWNERSHIP_HINT_KEYWORDS);

    if (this.isSensitiveDisclosureRequest(command)) {
      return {
        targetSpeaker: "owner",
        category: "security",
        question: "This looks sensitive. I should confirm with the owner before sharing anything. Should I ask the owner now?",
        ifNoOption: "I will not share business files, credentials, or internal data without the owner’s approval.",
        userFacingSummary: "Waiting on owner approval",
      };
    }

    if (hasPaymentWords && (hasWorkbookWords || hasDecisionWords)) {
      return {
        targetSpeaker: "boss",
        category: "approval",
        question: "I found a payment or payroll task. I can check the connected workbook data and then ask the boss if I should proceed. Should I do that?",
        ifNoOption: "If the workbook has no valid payment option, I should ask the employee to send one before I proceed.",
        userFacingSummary: "Payment decision pending boss approval",
      };
    }

    if (hasPaymentWords && /\b(option|method|methods|way|ways|alternative|alternatives|available|available option)\b/i.test(text)) {
      return {
        targetSpeaker: "employee",
        category: "missing-info",
        question: "I need a valid payment option from the employee before I can continue. Should I ask the employee for one now?",
        ifNoOption: "I need the employee to send a payment option before I can proceed.",
        userFacingSummary: "Waiting on employee payment option",
      };
    }

    if (hasDecisionWords && hasOwnershipWords) {
      return {
        targetSpeaker: "user",
        category: "clarification",
        question: "I need your confirmation before I proceed. Should I ask you for approval now?",
        ifNoOption: "I need a clear approval or an alternate instruction before continuing.",
        userFacingSummary: "Waiting on user confirmation",
      };
    }

    if (hasDecisionWords && /\b(data|record|records|file|files|doc|docs|document|documents|account|accounts|email|emails|inbox|drive)\b/i.test(text)) {
      return {
        targetSpeaker: "user",
        category: "clarification",
        question: "I need more context from you before I act on this. Should I ask you for the missing details now?",
        ifNoOption: "I need a few more details before I can choose the right next step.",
        userFacingSummary: "Waiting on more details",
      };
    }

    return null;
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

  cleanResearchQuery(command) {
    const text = this.normalizeAssistantText(command);
    const cleaned = text
      .replace(/^hey clicky[:,\s]*/i, "")
      .replace(/^clicky[:,\s]*/i, "")
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

  classifyCommand(command) {
    const normalized = this.normalizeAssistantText(command).toLowerCase();

    if (!normalized) {
      return { type: "no_op", reason: "empty-command" };
    }

    if (this.pendingDecision?.originalCommand && this.isApprovalNoCommand(normalized)) {
      this.pendingDecision = null;
      return { type: "cancel_pending", reason: "user-stopped" };
    }

    if (this.isStopCommand(normalized)) {
      this.pendingDecision = null;
      return { type: "cancel_pending", reason: "user-stopped" };
    }

    if (this.isApprovalYesCommand(normalized)) {
      if (this.pendingDecision?.originalCommand) {
        return {
          type: "resume_pending",
          pendingCommand: this.pendingDecision.originalCommand,
          approvedAction: this.pendingDecision.decisionContext?.approvedAction || null,
        };
      }
    }

    if (this.isCalendarCommand(normalized)) {
      return {
        type: "decision_request",
        targetSpeaker: "user",
        category: "desktop-control",
        question: "I need permission to open your local calendar and inspect the visible screen. Should I continue?",
        ifNoOption: "I will not open your calendar unless you approve it.",
        userFacingSummary: "Calendar check pending approval",
        approvedAction: {
          type: "calendar_check",
          command: this.normalizeAssistantText(command),
        },
      };
    }

    if (this.isScreenAnalysisCommand(normalized)) {
      return { type: "screen_analysis", command: this.normalizeAssistantText(command) };
    }

    const desktopWorkflow = this.buildDesktopWorkflowFromCommand(command);
    if (desktopWorkflow) {
      return {
        type: "decision_request",
        targetSpeaker: "user",
        category: "desktop-control",
        question: `I need permission to control your device for this action: ${desktopWorkflow.summary}. Should I continue?`,
        ifNoOption: "I will not control apps, files, or terminal commands unless you approve it.",
        userFacingSummary: "Desktop action pending approval",
        approvedAction: {
          type: "desktop_workflow",
          command: this.normalizeAssistantText(command),
          ...desktopWorkflow,
        },
      };
    }

    const decisionContext = this.buildDecisionContext(command);
    if (decisionContext) {
      return { type: "decision_request", ...decisionContext };
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

  async callClickyChat(command, options = {}) {
    if (!fetchFn) {
      throw new Error("No fetch implementation available in this runtime. Install 'node-fetch' or run on Node/Electron with global fetch.");
    }

    const memories = await this.memoryStore.getPromptMemories();

    const response = await fetchFn(this.getClickyChatUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: this.normalizeAssistantText(command),
        memories,
        screenshot: this.extractScreenshotBase64(options.screenshotDataUrl || options.screenshot),
      }),
      signal: options.signal,
    });

    const responseText = await response.text();
    let payload = null;

    try {
      payload = responseText ? JSON.parse(responseText) : null;
    } catch {
      payload = null;
    }

    if (!response.ok) {
      const message = payload?.reply || payload?.error || `Clicky chat failed with ${response.status}`;
      throw new Error(message);
    }

    return {
      payload,
      reply: this.normalizeAssistantText(payload?.reply),
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

  // Plan an action given the command and optional screenshot. Returns a small
  // action object that executeAction understands. This is where model calls
  // would be integrated later.
  async planAction(command, screenshotDataUrl) {
    return this.classifyCommand(command);
  }

  async replyToInteraction(command, options = {}) {
    this.notifyStatus("Answering...");
    const { reply, payload } = await this.callClickyChat(command, options);
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

    if (!screenshotDataUrl) {
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
      hasScreenshot: true,
    });

    const { reply, payload } = await this.callClickyChat(normalizedCommand, {
      ...options,
      screenshotDataUrl,
    });
    const text = reply || "I captured the screen, but I do not have a useful description yet.";

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
    const configuredUrl = this.normalizeAssistantText(process.env.CLICKY_CALENDAR_URL);
    const configuredProtocol = this.normalizeAssistantText(process.env.CLICKY_CALENDAR_PROTOCOL);
    const candidates = [];

    if (configuredUrl) {
      candidates.push({ type: "external", target: configuredUrl });
    }

    if (process.platform === "win32") {
      candidates.push(
        { type: "external", target: configuredProtocol || "outlookcal:" },
        { type: "external", target: "ms-outlook://calendar" },
        { type: "spawn", command: this.normalizeAssistantText(process.env.CLICKY_OUTLOOK_COMMAND) || "outlook.exe", args: ["/select", "outlook:calendar"] }
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
          } catch {
            // Ignore unref failures.
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

    await this.delay(Number(process.env.CLICKY_CALENDAR_OPEN_WAIT_MS || 3500), options.signal);
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
      const { reply, payload } = await this.callClickyChat(calendarPrompt, {
        ...options,
        screenshotDataUrl: screenshot,
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

    if (!this.clickyWorkflowExecutor) {
      this.clickyWorkflowExecutor = new WorkflowExecutor({
        mainWindow: this.mainWindow,
        userId: "clicky",
      });
    } else {
      this.clickyWorkflowExecutor.setMainWindow?.(this.mainWindow);
    }

    return this.clickyWorkflowExecutor;
  }

  getExistingDesktopWorkflowExecutor() {
    return getExecutor?.() || this.clickyWorkflowExecutor;
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
      const message = saveIntent.message || "I cannot store that in Clicky memory.";
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
        console.warn("[Clicky] Unknown action type:", action.type);
    }
  }

  emitDecisionRequest(command, decisionContext) {
    this.pendingDecision = {
      originalCommand: this.normalizeAssistantText(command),
      decisionContext,
      createdAt: Date.now(),
    };

    this.notifyStatus("Waiting for approval");
    this.emitAssistantEvent({
      type: "decision-needed",
      command: this.normalizeAssistantText(command),
      targetSpeaker: decisionContext.targetSpeaker || "user",
      ...decisionContext,
    });
    this.emitAssistantReply(decisionContext.question || decisionContext.ifNoOption || "I need approval before I continue.", {
      source: "decision",
      command: this.normalizeAssistantText(command),
    });
  }

  async smoothMove(targetX, targetY, options = {}) {
    if (!robotAvailable) return;

    this.throwIfStopped(options.signal);
    const start = robot.getMousePos();
    // Configurable smoothing: duration in ms and steps
    const duration = parseInt(process.env.CLICKY_SMOOTH_MOVE_MS || "400", 10);
    const steps = parseInt(process.env.CLICKY_SMOOTH_MOVE_STEPS || "60", 10);
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
        const error = new Error("Clicky request stopped.");
        error.name = "AbortError";
        reject(error);
        return;
      }

      const handleAbort = () => {
        clearTimeout(timeoutId);
        const error = new Error("Clicky request stopped.");
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
    if (this.clickyWindow && !this.clickyWindow.isDestroyed()) {
      this.clickyWindow.webContents.send("clicky:status", status);
    }
  }

  // Public entrypoint used by the preload bridge via IPC.
  async executeCommand(commandInput) {
    const commandPayload = this.normalizeCommandPayload(commandInput);
    const command = commandPayload.command;

    console.log(`[Clicky] executeCommand: ${command}`);
    if (this.isThinking) {
      if (this.isStopCommand(command)) {
        return this.stop("user-stopped");
      }

      const message = "I am still working on the last request. Please try again in a moment.";
      console.log("[Clicky] busy - ignoring command");
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
      let activeCommand = command;
      let approvedAction = null;

      const memoryResponse = await this.handleMemoryCommand(command);
      this.throwIfStopped(abortController.signal);
      if (memoryResponse) {
        this.notifyStatus("Ready");
        return memoryResponse;
      }

      this.throwIfStopped(abortController.signal);
      const screenshot = await this.perceive({
        preferDesktop: this.isScreenAnalysisCommand(this.normalizeAssistantText(command).toLowerCase()),
      });
      this.throwIfStopped(abortController.signal);

      const localDesktopCandidate =
        this.isCalendarCommand(this.normalizeAssistantText(command).toLowerCase()) ||
        this.buildDesktopWorkflowFromCommand(command);
      if (this.isSensitiveDisclosureRequest(command) && !localDesktopCandidate) {
        const message = "I'm Clicky, the Rearvy assistant. I can't share private or business files without owner approval, so I'll confirm with the owner and let you know.";
        this.notifyStatus("Needs owner approval");
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

      const plan = await this.planAction(command, screenshot);
      this.throwIfStopped(abortController.signal);

      if (plan?.type === "decision_request") {
        this.emitDecisionRequest(command, plan);
        return { ok: true, reason: "waiting-on-approval", message: plan.question };
      }

      if (plan?.type === "resume_pending") {
        const pendingCommand = plan.pendingCommand;
        this.pendingDecision = null;
        this.emitAssistantEvent({
          type: "decision-approved",
          command: this.normalizeAssistantText(pendingCommand),
        });
        this.emitAssistantReply("Approval received. Continuing now.", {
          source: "decision",
          command: this.normalizeAssistantText(pendingCommand),
        });
        activeCommand = pendingCommand;
        approvedAction = plan.approvedAction || null;
      }

      if (plan?.type === "cancel_pending") {
        this.pendingDecision = null;
        const message = "Canceled. I will stop this request.";
        this.emitAssistantEvent({
          type: "decision-canceled",
          command: this.normalizeAssistantText(command),
        });
        this.emitAssistantReply(message, {
          source: "decision",
          command: this.normalizeAssistantText(command),
        });
        this.notifyStatus("Ready");
        return { ok: true, reason: "canceled", message };
      }

      const replanned = approvedAction || (plan?.type === "resume_pending" ? await this.planAction(activeCommand, screenshot) : plan);
      this.throwIfStopped(abortController.signal);

      if (replanned?.type === "screen_analysis") {
        return await this.analyzeScreen(activeCommand, screenshot, { signal: abortController.signal });
      }

      if (replanned?.type === "calendar_check") {
        return await this.checkCalendar(activeCommand, { signal: abortController.signal });
      }

      if (replanned?.type === "desktop_workflow") {
        return await this.runDesktopWorkflowAction(replanned, { signal: abortController.signal });
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
        const response = await this.replyToInteraction(activeCommand, { signal: abortController.signal });
        this.notifyStatus("Ready");
        return response;
      }

      if (replanned?.type === "no_op") {
        const message =
          replanned.reason === "voice-trigger"
            ? "I'm listening. Say Hey Clicky followed by what you need."
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
        return { ok: true, reason: "stopped", message: "Clicky stopped." };
      }

      console.error("[Clicky] Execution failed:", err);
      const message = "I could not complete that request. Please check Clicky setup and try again.";
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
        const screenshot = await this.perceive({ preferDesktop: true });
        this.throwIfStopped(abortController.signal);
        return await this.analyzeScreen(command, screenshot, { signal: abortController.signal });
      }

      const screenshot = await this.perceive();
      this.throwIfStopped(abortController.signal);
      return await this.researchWithFirecrawl(command, screenshot, { signal: abortController.signal });
    } catch (err) {
      if (abortController.signal.aborted || this.isAbortError(err)) {
        return { ok: true, reason: "stopped", message: "Clicky stopped." };
      }

      const message = "I could not finish that research request. Please check Clicky setup and try again.";
      console.error("[Clicky] Research failed:", err);
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

  stop(reason = "user-stopped") {
    const wasThinking = this.isThinking;
    this.pendingDecision = null;

    try {
      this.activeAbortController?.abort();
    } catch {}

    try {
      this.getExistingDesktopWorkflowExecutor()?.stop?.();
    } catch {}

    this.activeAbortController = null;
    this.isThinking = false;
    this.activeReplyMetadata = {};

    const message = wasThinking ? "Clicky stopped." : "Clicky is already ready.";
    this.emitAssistantEvent({
      type: "command-stopped",
      reason,
      message,
    });
    this.notifyStatus("Ready");

    return { ok: true, stopped: wasThinking, reason, message };
  }
}

function setupClickyLogic(mainWindow, clickyWindow, appUrl) {
  const brain = new ClickyBrain(mainWindow, clickyWindow, appUrl);

  ipcMain.handle("clicky:command", async (_event, command) => {
    return await brain.executeCommand(command);
  });

  ipcMain.handle("clicky:research", async (_event, command) => {
    return await brain.research(command);
  });

  ipcMain.handle("clicky:stop", async () => {
    return brain.stop("user-stopped");
  });
}

module.exports = { setupClickyLogic };
