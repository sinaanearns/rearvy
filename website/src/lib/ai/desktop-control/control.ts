/**
 * Desktop Control Layer - Execute actions on desktop
 * Handles: mouse clicks, keyboard input, window management, app launching
 */

import { DesktopAction, ActionResult, ScreenPerception } from "./types";
import { capturePerception } from "./vision";

type RuntimeRequire = (name: string) => unknown;
type MouseButton = "left" | "right" | "middle";
type KeyDirection = "down" | "up";

interface MousePosition {
  x: number;
  y: number;
}

interface RobotModule {
  moveMouse(x: number, y: number): void;
  mouseClick(button?: MouseButton): void;
  typeString(text: string): void;
  keyToggle(key: string, direction: KeyDirection, modifiers?: string[]): void;
  getMousePos?: () => MousePosition;
  mouseToggle?: (direction: KeyDirection, button?: MouseButton) => void;
  dragMouse?: (x: number, y: number) => void;
  scroll?: (x: number, y: number) => void;
}

interface WindowLike {
  getTitle?: () => string;
  close?: () => void;
}

interface WindowManagerModule {
  getWindows?: () => WindowLike[];
  getActiveWindow?: () => WindowLike | null | undefined;
}

// Lazy-loaded platform-specific modules
let robot: RobotModule | null = null;
let windowManager: WindowManagerModule | null = null;

// Keep native desktop modules runtime-only so Next/Turbopack does not trace them.
function tryRequire(name: string): unknown | null {
  try {
    const runtimeRequire = eval("require") as RuntimeRequire;
    return runtimeRequire(name);
  } catch {
    return null;
  }
}

function getRuntimeModule<T>(loaded: unknown): T | null {
  if (!loaded) {
    return null;
  }

  if (typeof loaded === "object" && "default" in loaded) {
    const defaultExport = (loaded as { default?: unknown }).default;
    return (defaultExport || loaded) as T;
  }

  return loaded as T;
}

/**
 * Initialize desktop control dependencies
 */
export async function initializeDesktopControl(): Promise<void> {
  try {
    // Load robotjs for mouse/keyboard control (runtime-only)
    const loadedRobot = getRuntimeModule<RobotModule>(tryRequire("robotjs"));
    if (loadedRobot) robot = loadedRobot;
  } catch (err) {
    console.warn("robotjs not installed. Some actions will be unavailable.", err);
  }

  try {
    // Load window manager for window operations (runtime-only)
    const loadedWindowManager = getRuntimeModule<WindowManagerModule>(tryRequire("node-window-manager"));
    if (loadedWindowManager) windowManager = loadedWindowManager;
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

      case "dragMouse":
        await performDragMouse(action);
        break;

      case "mouseDown":
        await performMouseToggle("down", action.button);
        break;

      case "mouseUp":
        await performMouseToggle("up", action.button);
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
        throw new Error(`Unknown action type: ${action.type}`);
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
async function performClick(x: number, y: number, button: MouseButton = "left", double: boolean = false): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for click action");
  }

  // Move to position
  robot.moveMouse(x, y);

  // Small delay for natural movement
  await performWait(50);

  // Perform click(s)
  if (double) {
    robot.mouseClick(button);
    await performWait(100);
    robot.mouseClick(button);
  } else {
    robot.mouseClick(button);
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
    robot.typeString(char);

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

  robot.keyToggle(mappedKeys[mappedKeys.length - 1], "down", mappedKeys.slice(0, -1));
  await performWait(50);
  robot.keyToggle(mappedKeys[mappedKeys.length - 1], "up", mappedKeys.slice(0, -1));
}

/**
 * Move mouse to coordinates (with optional smooth movement)
 */
async function performMouseMove(x: number, y: number, duration: number = 0): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for moveMouse action");
  }

  if (duration <= 0) {
    robot.moveMouse(x, y);
  } else {
    // Smooth movement using small steps
    const currentPos = robot.getMousePos?.();
    if (!currentPos) {
      throw new Error("robotjs getMousePos not available for smooth mouse movement");
    }

    const steps = Math.ceil(duration / 16); // ~60fps
    const stepX = (x - currentPos.x) / steps;
    const stepY = (y - currentPos.y) / steps;

    for (let i = 0; i < steps; i++) {
      robot.moveMouse(currentPos.x + stepX * (i + 1), currentPos.y + stepY * (i + 1));
      await performWait(16); // ~60fps
    }
  }
}

function normalizeMouseButton(button: string = "left"): MouseButton {
  const normalized = button.toLowerCase();
  if (normalized === "left" || normalized === "right" || normalized === "middle") {
    return normalized;
  }

  throw new Error(`Unsupported mouse button: ${button}`);
}

async function performMouseToggle(direction: "down" | "up", button: string = "left"): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for mouse toggle action");
  }

  if (!robot.mouseToggle) {
    throw new Error("robotjs mouseToggle not available for mouse toggle action");
  }

  robot.mouseToggle(direction, normalizeMouseButton(button));
}

async function performDragMouse(action: Extract<DesktopAction, { type: "dragMouse" }>): Promise<void> {
  if (!robot) {
    throw new Error("robotjs not available for dragMouse action");
  }

  const rawToX = action.toX ?? action.x;
  const rawToY = action.toY ?? action.y;
  if (rawToX === null || rawToX === undefined || rawToY === null || rawToY === undefined) {
    throw new Error("dragMouse requires x/y or toX/toY coordinates");
  }

  const toX = Number(rawToX);
  const toY = Number(rawToY);
  if (!Number.isFinite(toX) || !Number.isFinite(toY)) {
    throw new Error("dragMouse requires x/y or toX/toY coordinates");
  }

  if (
    typeof action.fromX === "number" &&
    typeof action.fromY === "number" &&
    Number.isFinite(action.fromX) &&
    Number.isFinite(action.fromY)
  ) {
    robot.moveMouse(Math.round(action.fromX), Math.round(action.fromY));
  }

  const button = normalizeMouseButton(action.button);
  const durationMs = typeof action.durationMs === "number" && Number.isFinite(action.durationMs)
    ? Math.max(0, Math.min(5000, Math.round(action.durationMs)))
    : 350;
  const steps = typeof action.steps === "number" && Number.isFinite(action.steps)
    ? Math.max(1, Math.min(120, Math.round(action.steps)))
    : 24;

  const dragMouse = robot.dragMouse?.bind(robot);
  const mouseToggle = robot.mouseToggle?.bind(robot);

  if (durationMs === 0 || !mouseToggle) {
    if (!dragMouse) {
      throw new Error("robotjs dragMouse not available for dragMouse action");
    }

    dragMouse(Math.round(toX), Math.round(toY));
    return;
  }

  const start = robot.getMousePos?.() || { x: toX, y: toY };
  mouseToggle("down", button);
  try {
    for (let index = 1; index <= steps; index += 1) {
      const progress = index / steps;
      robot.moveMouse(
        Math.round(start.x + (toX - start.x) * progress),
        Math.round(start.y + (toY - start.y) * progress)
      );
      if (index < steps) {
        await performWait(Math.max(1, Math.round(durationMs / steps)));
      }
    }
  } finally {
    mouseToggle("up", button);
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
    const windows = windowManager.getWindows?.();
    if (!windows) {
      throw new Error("Could not get windows list");
    }

    const targetWindow = windowTitle
      ? windows.find((windowItem) => windowItem.getTitle?.().includes(windowTitle) ?? false)
      : windowManager.getActiveWindow?.();

    if (targetWindow) {
      if (force) {
        if (robot) {
          robot.keyToggle("alt", "down");
          robot.keyToggle("F4", "down");
          await performWait(100);
          robot.keyToggle("F4", "up");
          robot.keyToggle("alt", "up");
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
    if (!robot.scroll) {
      throw new Error("robotjs scroll not available");
    }

    robot.scroll(scrollX, scrollY);
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
