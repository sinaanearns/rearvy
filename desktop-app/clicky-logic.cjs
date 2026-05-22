const { ipcMain, desktopCapturer } = require("electron");
const robot = require("robotjs");

const FIRECRAWL_BASE_URL = "https://api.firecrawl.dev/v2";
const FIRECRAWL_RESEARCH_KEYWORDS = ["research", "find", "look up", "search", "what's on", "what is on", "summarize", "explain"];

/**
 * Clicky Logic - The Brain of the Mouse Assistant
 *
 * This file refactors the previous monolithic execute flow into a small
 * perception -> planning -> execution pipeline. The public IPC surface
 * (`clicky:command`, `clicky:status`) is preserved so the UI/preload
 * bridge does not need to change.
 */
class ClickyBrain {
  constructor(mainWindow, clickyWindow) {
    this.mainWindow = mainWindow;
    this.clickyWindow = clickyWindow;
    this.isThinking = false;
    this.latestAssistantEvent = null;
  }

  // Capture the screen as a data URL (if available).
  async perceive() {
    try {
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

  emitAssistantEvent(event) {
    this.latestAssistantEvent = event;

    if (this.clickyWindow && !this.clickyWindow.isDestroyed()) {
      this.clickyWindow.webContents.send("clicky:assistant-event", event);
    }

    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send("clicky:assistant-event", event);
    }
  }

  normalizeAssistantText(value) {
    return String(value || "").trim();
  }

  isResearchCommand(normalizedCommand) {
    return FIRECRAWL_RESEARCH_KEYWORDS.some((keyword) => normalizedCommand.includes(keyword));
  }

  looksLikeUrl(normalizedCommand) {
    return /https?:\/\//i.test(normalizedCommand) || /^www\./i.test(normalizedCommand);
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

    const response = await fetch(`${FIRECRAWL_BASE_URL}${endpointPath}`, {
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

  // Execute a planned action. Keep each action small and explicit.
  async executeAction(action) {
    if (!action || action.type === "no_op") return;

    switch (action.type) {
      case "navigate_and_click":
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

  async smoothMove(targetX, targetY) {
    const start = robot.getMousePos();
    const steps = 20;
    for (let i = 0; i <= steps; i++) {
      const x = start.x + (targetX - start.x) * (i / steps);
      const y = start.y + (targetY - start.y) * (i / steps);
      robot.moveMouse(x, y);
      await this.delay(10);
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
  async executeCommand(command) {
    console.log(`[Clicky] executeCommand: ${command}`);
    if (this.isThinking) {
      console.log("[Clicky] busy — ignoring command");
      return { ok: false, reason: "busy" };
    }

    this.isThinking = true;
    this.notifyStatus("Thinking...");
    this.emitAssistantEvent({ type: "command-started", command: this.normalizeAssistantText(command) });

    try {
      const screenshot = await this.perceive();
      const plan = await this.planAction(command, screenshot);

      if (plan?.type === "research") {
        return await this.researchWithFirecrawl(command, screenshot);
      }

      if (plan?.type === "scrape") {
        if (!plan.url) {
          throw new Error("Could not determine a URL to scrape.");
        }

        return await this.scrapeUrlWithFirecrawl(plan.url);
      }

      this.notifyStatus(plan?.reason || "Executing...");
      await this.executeAction(plan);

      this.emitAssistantEvent({
        type: "command-completed",
        command: this.normalizeAssistantText(command),
        mode: plan?.type || "interaction",
      });
      this.notifyStatus("Ready");
      return { ok: true };
    } catch (err) {
      console.error("[Clicky] Execution failed:", err);
      this.emitAssistantEvent({
        type: "command-failed",
        command: this.normalizeAssistantText(command),
        error: String(err),
      });
      this.notifyStatus("Error occurred");
      return { ok: false, error: String(err) };
    } finally {
      this.isThinking = false;
    }
  }

  async research(command) {
    const screenshot = await this.perceive();
    return await this.researchWithFirecrawl(command, screenshot);
  }
}

function setupClickyLogic(mainWindow, clickyWindow) {
  const brain = new ClickyBrain(mainWindow, clickyWindow);

  ipcMain.handle("clicky:command", async (_event, command) => {
    return await brain.executeCommand(command);
  });

  ipcMain.handle("clicky:research", async (_event, command) => {
    return await brain.research(command);
  });
}

module.exports = { setupClickyLogic };
