const { ipcMain, desktopCapturer } = require("electron");
const robot = require("robotjs");

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

  // Plan an action given the command and optional screenshot. Returns a small
  // action object that executeAction understands. This is where model calls
  // would be integrated later.
  async planAction(command, screenshotDataUrl) {
    // Placeholder planning logic — keep structured so it's easy to replace.
    const normalized = (command || "").toLowerCase();

    if (normalized.includes("shopify")) {
      return { type: "navigate_and_click", x: 500, y: 400, text: "https://shopify.com" };
    }

    if (normalized.includes("search") || normalized.includes("search for") || normalized.includes("find")) {
      return { type: "type_and_enter", x: 100, y: 100, text: command };
    }

    if (normalized.includes("voice") || normalized.includes("listen") || normalized.includes("voice command")) {
      return { type: "no_op", reason: "voice-trigger" };
    }

    // Default fallback: click and type the command as a search
    return { type: "type_and_enter", x: 100, y: 100, text: command };
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

    try {
      const screenshot = await this.perceive();
      const plan = await this.planAction(command, screenshot);

      this.notifyStatus(plan?.reason || "Executing...");
      await this.executeAction(plan);

      this.notifyStatus("Ready");
      return { ok: true };
    } catch (err) {
      console.error("[Clicky] Execution failed:", err);
      this.notifyStatus("Error occurred");
      return { ok: false, error: String(err) };
    } finally {
      this.isThinking = false;
    }
  }
}

function setupClickyLogic(mainWindow, clickyWindow) {
  const brain = new ClickyBrain(mainWindow, clickyWindow);

  ipcMain.handle("clicky:command", async (_event, command) => {
    return await brain.executeCommand(command);
  });
}

module.exports = { setupClickyLogic };
