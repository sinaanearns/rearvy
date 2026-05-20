const { ipcMain, desktopCapturer } = require("electron");
const robot = require("robotjs");

/**
 * Clicky Logic - The Brain of the Mouse Assistant
 */
class ClickyBrain {
  constructor(mainWindow, clickyWindow) {
    this.mainWindow = mainWindow;
    this.clickyWindow = clickyWindow;
    this.isThinking = false;
  }

  /**
   * Capture the screen and analyze it
   */
  async perceive() {
    const sources = await desktopCapturer.getSources({ 
      types: ["screen"], 
      thumbnailSize: { width: 1920, height: 1080 } 
    });
    
    if (sources.length > 0) {
      return sources[0].thumbnail.toDataURL();
    }
    return null;
  }

  /**
   * Execute a natural language command by translating it to mouse actions
   */
  async executeCommand(command) {
    console.log(`[Clicky] Brain thinking about: ${command}`);
    this.isThinking = true;
    this.notifyStatus("Thinking...");

    try {
      // 1. Perceive screen
      const screenshot = await this.perceive();
      
      // 2. Call AI to decide actions (Mocking for now, in reality call NVIDIA/Claude)
      // Here we would call an API with the screenshot and command
      
      // MOCK ACTION: If command is "Setup Shopify", move to center and click
      if (command.toLowerCase().includes("shopify")) {
        this.notifyStatus("Setting up Shopify...");
        await this.smoothMove(500, 400);
        robot.mouseClick();
        await this.delay(1000);
        robot.typeString("https://shopify.com");
        robot.keyTap("enter");
      } else {
        // General search
        await this.smoothMove(100, 100);
        robot.mouseClick();
        robot.typeString(command);
        robot.keyTap("enter");
      }

      this.notifyStatus("Ready");
    } catch (err) {
      console.error("[Clicky] Execution failed:", err);
      this.notifyStatus("Error occurred");
    } finally {
      this.isThinking = false;
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  notifyStatus(status) {
    if (this.clickyWindow && !this.clickyWindow.isDestroyed()) {
      this.clickyWindow.webContents.send("clicky:status", status);
    }
  }
}

function setupClickyLogic(mainWindow, clickyWindow) {
  const brain = new ClickyBrain(mainWindow, clickyWindow);

  ipcMain.handle("clicky:command", async (event, command) => {
    return await brain.executeCommand(command);
  });
}

module.exports = { setupClickyLogic };
