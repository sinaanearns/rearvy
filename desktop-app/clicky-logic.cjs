const { ipcMain } = require("electron");
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
    this.latestAssistantEvent = null;
    this.pendingDecision = null;
    this.activeReplyMetadata = {};
  }

  // Capture the screen as a data URL (if available).
  async perceive() {
    try {
      // Prefer using the main window's capturePage API when available
      if (this.mainWindow && this.mainWindow.webContents && typeof this.mainWindow.webContents.capturePage === "function") {
        try {
          const image = await this.mainWindow.webContents.capturePage();
          if (image && typeof image.toDataURL === "function") return image.toDataURL();
        } catch (err) {
          // Fall through to desktopCapturer approach
          console.warn("[Clicky] capturePage failed, falling back to desktopCapturer:", err?.message || err);
        }
      }

      // Fallback: use desktopCapturer if available (may only exist in some
      // Electron contexts). This is best-effort and may return null.
      const { desktopCapturer } = require("electron");
      const sources = await desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width: 1920, height: 1080 },
      });
      if (sources && sources.length > 0) return sources[0].thumbnail.toDataURL();
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

  looksLikeUrl(normalizedCommand) {
    return /https?:\/\//i.test(normalizedCommand) || /^www\./i.test(normalizedCommand);
  }

  hasKeyword(text, keywords) {
    return keywords.some((keyword) => text.includes(keyword));
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

  classifyCommand(command) {
    const normalized = this.normalizeAssistantText(command).toLowerCase();

    if (!normalized) {
      return { type: "no_op", reason: "empty-command" };
    }

    if (normalized === "stop" || normalized === "pause" || normalized === "cancel") {
      this.pendingDecision = null;
      return { type: "cancel_pending", reason: "user-stopped" };
    }

    if (normalized === "continue" || normalized === "proceed" || normalized === "yes") {
      if (this.pendingDecision?.originalCommand) {
        return { type: "resume_pending", pendingCommand: this.pendingDecision.originalCommand };
      }
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

  async callFirecrawl(endpointPath, body) {
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

  async callClickyChat(command) {
    if (!fetchFn) {
      throw new Error("No fetch implementation available in this runtime. Install 'node-fetch' or run on Node/Electron with global fetch.");
    }

    const response = await fetchFn(this.getClickyChatUrl(), {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: this.normalizeAssistantText(command),
      }),
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

  async researchWithFirecrawl(command, screenshotDataUrl) {
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
    });

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

  async scrapeUrlWithFirecrawl(url) {
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
    });

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

  async replyToInteraction(command) {
    this.notifyStatus("Answering...");
    const { reply, payload } = await this.callClickyChat(command);
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

  // Execute a planned action. Keep each action small and explicit.
  async executeAction(action) {
    if (!action || action.type === "no_op") return;

    switch (action.type) {
      case "navigate_and_click":
        if (!robotAvailable) {
          throw new Error("Mouse actions are disabled: native module 'robotjs' not available");
        }

        await this.smoothMove(action.x, action.y);
        robot.mouseClick();
        await this.delay(300);
        if (action.text) {
          robot.typeString(action.text);
          await this.delay(50);
          robot.keyTap("enter");
        }
        break;

      case "type_and_enter":
        if (!robotAvailable) {
          throw new Error("Mouse actions are disabled: native module 'robotjs' not available");
        }

        await this.smoothMove(action.x, action.y);
        robot.mouseClick();
        await this.delay(100);
        if (action.text) {
          robot.typeString(action.text);
          await this.delay(50);
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

  async smoothMove(targetX, targetY) {
    if (!robotAvailable) return;

    const start = robot.getMousePos();
    // Configurable smoothing: duration in ms and steps
    const duration = parseInt(process.env.CLICKY_SMOOTH_MOVE_MS || "400", 10);
    const steps = parseInt(process.env.CLICKY_SMOOTH_MOVE_STEPS || "60", 10);
    const delay = Math.max(4, Math.floor(duration / Math.max(1, steps)));

    // Cubic ease-out for a natural feel
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const eased = easeOutCubic(t);
      const x = start.x + (targetX - start.x) * eased;
      const y = start.y + (targetY - start.y) * eased;
      try {
        robot.moveMouse(Math.round(x), Math.round(y));
      } catch (e) {
        // ignore transient native errors during movement
      }
      await this.delay(delay);
    }
  }

  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
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

    this.isThinking = true;
    this.activeReplyMetadata = {
      requestId: commandPayload.requestId,
      origin: commandPayload.origin,
    };
    this.notifyStatus("Thinking...");
    this.emitAssistantEvent({ type: "command-started", command: this.normalizeAssistantText(command) });

    try {
      let activeCommand = command;
      const screenshot = await this.perceive();

      if (this.isSensitiveDisclosureRequest(command)) {
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

      const replanned = plan?.type === "resume_pending" ? await this.planAction(activeCommand, screenshot) : plan;

      if (replanned?.type === "research") {
        return await this.researchWithFirecrawl(command, screenshot);
      }

      if (replanned?.type === "scrape") {
        if (!replanned.url) {
          throw new Error("Could not determine a URL to scrape.");
        }

        return await this.scrapeUrlWithFirecrawl(replanned.url);
      }

      if (replanned?.type === "interaction") {
        const response = await this.replyToInteraction(activeCommand);
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
      await this.executeAction(replanned);

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
      this.isThinking = false;
      this.activeReplyMetadata = {};
    }
  }

  async research(commandInput) {
    const commandPayload = this.normalizeCommandPayload(commandInput);
    const command = commandPayload.command;
    this.activeReplyMetadata = {
      requestId: commandPayload.requestId,
      origin: commandPayload.origin,
    };

    try {
      const screenshot = await this.perceive();
      return await this.researchWithFirecrawl(command, screenshot);
    } catch (err) {
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
      this.activeReplyMetadata = {};
    }
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
}

module.exports = { setupClickyLogic };
