/**
 * Desktop Control Layer - Execute actions on desktop
 * Handles: mouse clicks, keyboard input, window management, app launching
 */

import { DesktopAction, ActionResult, ScreenPerception } from "./types";
import { capturePerception } from "./vision";

// Lazy-loaded platform-specific modules
let robot: any;
let windowManager: any;

// Try to require native modules at runtime without letting bundlers statically
// analyze the dependency. Using eval('require') avoids Turbopack/webpack
// resolving these native modules during build.
function tryRequire(name: string) {
  try {
    // @ts-ignore
    return require(name);
  } catch (e) {
    try {
      // Avoid static analysis by using eval
       
      return eval("require")(name);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Initialize desktop control dependencies
 */
export async function initializeDesktopControl(): Promise<void> {
  try {
    // Load robotjs for mouse/keyboard control (runtime-only)
    const r = tryRequire("robotjs");
    if (r) robot = r.default || r;
  } catch (err) {
    console.warn("robotjs not installed. Some actions will be unavailable.", err);
  }

  try {
    // Load window manager for window operations (runtime-only)
    const w = tryRequire("node-window-manager");
    if (w) windowManager = w.default || w;
  } catch (err) {
    console.warn("node-window-manager not installed.", err);
  }
}

/**
 * Execute a single desktop action
 * Captures perception after execution
 * @param action Action to execute
 * @param claudeApiKey Optional API key for UI analysis
 * @returns Result of action execution
 */
export async function executeAction(action: DesktopAction, claudeApiKey?: string): Promise<ActionResult> {
  const startTime = Date.now();

  try {
    let output: string | undefined;

    // Execute based on action type
    switch (action.type) {
      case "click":
        await performClick(action.x, action.y, action.button, action.double);
        break;

      case "type":
        await performType(action.text, action.delay);
        break;

      case "keyPress":
        await performKeyPress(action.key, action.modifiers);
        break;

      case "moveMouse":
        await performMouseMove(action.x, action.y, action.duration);
        break;

      case "screenshot":
        // Just capture, handled by perception below
        break;

      case "launchApp":
        await launchApp(action.appPath, action.args, action.wait);
        break;

      case "closeWindow":
        await closeWindow(action.windowTitle, action.force);
        break;

      case "setClipboard":
        await setClipboard(action.text);
        break;

      case "getClipboard":
        output = await getClipboard();
        break;

      case "wait":
        await performWait(action.ms);
        break;

      case "scroll":
        await performScroll(action.direction, action.amount);
        break;

      default:
        throw new Error(`Unknown action type: ${(action as any).type}`);
    }

    // Capture perception after action
    let perception: ScreenPerception | undefined;
    try {
      perception = await capturePerception(true, claudeApiKey);
    } catch (err) {
      console.warn("Failed to capture perception after action:", err);
    }

    const durationMs = Date.now() - startTime;

    console.log(`[Control] Action ${action.type} completed in ${durationMs}ms`);

    return {
      success: true,
      action,
      durationMs,
      perception,
      output,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const errorMsg = err instanceof Error ? err.message : String(err);

    console.error(`[Control] Action ${action.type} failed:`, errorMsg);

    return {
      success: false,
      action,
      durationMs,
      error: errorMsg,
    };
  }
}

/**
 * Click at specified coordinates
 */
async function performClick(x: number, y: number, button: string = "left", double: boolean = false): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for click action");
  }

  // Move to position
  (robot as any).moveMouse(x, y);

  // Small delay for natural movement
  await performWait(50);

  // Perform click(s)
  if (double) {
    (robot as any).mouseClick(button);
    await performWait(100);
    (robot as any).mouseClick(button);
  } else {
    (robot as any).mouseClick(button);
  }
}

/**
 * Type text with optional delay between characters
 */
async function performType(text: string, delay: number = 50): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for type action");
  }

  for (const char of text) {
    (robot as any).typeString(char);

    if (delay > 0) {
      await performWait(delay);
    }
  }
}

/**
 * Press a key or key combination
 */
async function performKeyPress(key: string, modifiers: string[] = []): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for keyPress action");
  }

  // Build key combination
  const keys = [...(modifiers || []), key];

  // robotjs expects: 'shift', 'control', 'alt'
  const mappedKeys = keys.map((k) => {
    const lower = k.toLowerCase();
    if (lower === "control" || lower === "ctrl") return "control";
    if (lower === "shift") return "shift";
    if (lower === "alt") return "alt";
    return k;
  });

  (robot as any).keyToggle(mappedKeys[mappedKeys.length - 1], "down", mappedKeys.slice(0, -1));
  await performWait(50);
  (robot as any).keyToggle(mappedKeys[mappedKeys.length - 1], "up", mappedKeys.slice(0, -1));
}

/**
 * Move mouse to coordinates (with optional smooth movement)
 */
async function performMouseMove(x: number, y: number, duration: number = 0): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for moveMouse action");
  }

  if (duration <= 0) {
    (robot as any).moveMouse(x, y);
  } else {
    // Smooth movement using small steps
    const currentPos = (robot as any).getMousePos();
    const steps = Math.ceil(duration / 16); // ~60fps
    const stepX = (x - currentPos.x) / steps;
    const stepY = (y - currentPos.y) / steps;

    for (let i = 0; i < steps; i++) {
      (robot as any).moveMouse(currentPos.x + stepX * (i + 1), currentPos.y + stepY * (i + 1));
      await performWait(16); // ~60fps
    }
  }
}

/**
 * Launch an application
 */
async function launchApp(appPath: string, args: string[] = [], wait: boolean = true): Promise<void> {
  try {
    const { spawn } = await import("child_process");

    return new Promise((resolve, reject) => {
      const proc = spawn(appPath, args || [], {
        detached: true,
        stdio: "ignore",
      });

      if (!wait) {
        proc.unref();
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        resolve(); // Timeout after 10s
      }, 10000);

      proc.on("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });

      proc.on("exit", () => {
        clearTimeout(timeout);
        resolve();
      });
    });
  } catch (err) {
    throw new Error(`Failed to launch app ${appPath}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Close a window
 */
async function closeWindow(windowTitle?: string, force: boolean = false): Promise<void> {
  if (!windowManager) {
    throw new Error("window-manager not available for closeWindow action");
  }

  try {
    const windows = (windowManager as any).getWindows?.();
    if (!windows) {
      throw new Error("Could not get windows list");
    }

    const targetWindow = windowTitle
      ? windows.find((w: any) => w.getTitle().includes(windowTitle))
      : (windowManager as any).getActiveWindow?.();

    if (targetWindow) {
      if (force) {
        if (robot) {
          (robot as any).keyToggle("alt", "down");
          (robot as any).keyToggle("F4", "down");
          await performWait(100);
          (robot as any).keyToggle("F4", "up");
          (robot as any).keyToggle("alt", "up");
        }
      } else {
        targetWindow.close?.();
      }
    }
  } catch (err) {
    throw new Error(`Failed to close window: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Copy text to clipboard
 */
async function setClipboard(text: string): Promise<void> {
  try {
    const clipboardy = await import("clipboardy").then((m) => m.default || m);
    await clipboardy.write(text);
  } catch (err) {
    throw new Error(`Failed to set clipboard: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Get text from clipboard
 */
async function getClipboard(): Promise<string> {
  try {
    const clipboardy = await import("clipboardy").then((m) => m.default || m);
    return await clipboardy.read();
  } catch (err) {
    throw new Error(`Failed to get clipboard: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Wait for specified milliseconds
 */
function performWait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Scroll in a direction
 */
async function performScroll(direction: "up" | "down" | "left" | "right", amount: number): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for scroll action");
  }

  // robotjs scroll values
  let scrollX = 0;
  let scrollY = 0;

  if (direction === "up") scrollY = amount;
  if (direction === "down") scrollY = -amount;
  if (direction === "left") scrollX = -amount;
  if (direction === "right") scrollX = amount;

  // Use scroll (may not work on all platforms, fallback to wheel)
  try {
    (robot as any).scroll(scrollX, scrollY);
  } catch {
    // Fallback: use keyboard
    const key = direction === "up" ? "up" : direction === "down" ? "down" : direction === "left" ? "left" : "right";
    for (let i = 0; i < amount; i++) {
      await performKeyPress(key);
      await performWait(50);
    }
  }
}

/**
 * Execute multiple actions sequentially
 * @param actions Array of actions to execute
 * @param claudeApiKey Optional API key for UI analysis
 * @returns Array of results
 */
export async function executeActionSequence(
  actions: DesktopAction[],
  claudeApiKey?: string
): Promise<ActionResult[]> {
  const results: ActionResult[] = [];

  for (const action of actions) {
    const result = await executeAction(action, claudeApiKey);
    results.push(result);

    if (!result.success) {
      console.error(`Action sequence stopped due to failure at ${action.type}`);
      break;
    }

    // Small delay between actions to prevent race conditions
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  return results;
}
