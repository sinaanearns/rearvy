/**
 * Vision Layer - Screenshot Capture & Analysis
 * Handles: screenshot capture, OCR, UI element detection
 */

import { ScreenPerception, UIElement, OCRResult } from "./types";
import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("DesktopVision");

type RuntimeRequire = (name: string) => unknown;
type ScreenshotModule = () => Promise<Buffer | string>;

interface TesseractBoundingBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface WindowLike {
  getTitle?: () => string;
}

interface WindowManagerModule {
  getActiveWindow?: () => WindowLike | null | undefined;
}

interface RobotModule {
  getMousePos?: () => { x: number; y: number };
}

// Platform-specific imports (lazy loaded)
let screenshot: ScreenshotModule | null = null;

// Safe runtime require helper to avoid static bundlers resolving native modules.
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
 * Initialize vision layer dependencies
 * This runs once on startup to load native modules
 */
export async function initializeVisionLayer(): Promise<void> {
  try {
    // Try to load screenshot library
    // Using 'screenshot-desktop' package for cross-platform support
    const loadedScreenshot = getRuntimeModule<ScreenshotModule>(tryRequire("screenshot-desktop"));
    if (loadedScreenshot) screenshot = loadedScreenshot;
  } catch (err) {
    log.warn("screenshot-desktop not installed. Using fallback.", err);
    // Fallback: require native screenshot module if available
  }
}

/**
 * Capture current desktop screenshot
 * @returns Buffer containing PNG image of current screen
 */
export async function captureScreenshot(): Promise<Buffer> {
  try {
    if (!screenshot) {
      await initializeVisionLayer();
    }

    if (!screenshot) {
      throw new Error("screenshot-desktop not available");
    }

    // screenshot-desktop returns png as Buffer
    const img = await screenshot();
    if (!img) {
      throw new Error("Screenshot returned null");
    }

    // Ensure it's a Buffer
    if (typeof img === "string") {
      return Buffer.from(img, "base64");
    }

    if (Buffer.isBuffer(img)) {
      return img;
    }

    throw new Error("Screenshot returned unsupported image data");
  } catch (err) {
    log.error("Failed to capture screenshot:", err);
    throw new Error(`Screenshot capture failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Run OCR on screenshot buffer
 * Uses Tesseract.js for local OCR (no API calls)
 * @param imageBuffer PNG/JPG image buffer
 * @returns OCR results with text and bounding boxes
 */
export async function performOCR(imageBuffer: Buffer): Promise<OCRResult> {
  try {
    // Lazy load Tesseract
    const Tesseract = await import("tesseract.js");
    const worker = await Tesseract.createWorker();

    const result = await worker.recognize(imageBuffer);
    await worker.terminate();

    const text = result.data.text;
    const boundingBoxes = extractBoundingBoxes(result.data);

    return {
      text,
      confidence: result.data.confidence / 100,
      boundingBoxes,
    };
  } catch (err) {
    log.error("OCR failed:", err);
    throw new Error(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extract bounding boxes from Tesseract result
 * @internal
 */
function extractBoundingBoxes(
  data: unknown
): Array<{ text: string; box: { x: number; y: number; width: number; height: number } }> {
  const boxes: Array<{ text: string; box: { x: number; y: number; width: number; height: number } }> = [];

  if (!isRecord(data) || !Array.isArray(data.words)) {
    return boxes;
  }

  for (const rawWord of data.words) {
    if (!isRecord(rawWord) || typeof rawWord.text !== "string" || !isTesseractBoundingBox(rawWord.bbox)) {
      continue;
    }

    boxes.push({
      text: rawWord.text,
      box: {
        x: rawWord.bbox.x0,
        y: rawWord.bbox.y0,
        width: rawWord.bbox.x1 - rawWord.bbox.x0,
        height: rawWord.bbox.y1 - rawWord.bbox.y0,
      },
    });
  }

  return boxes;
}

/**
 * Detect UI elements using Claude Vision API
 * Calls Claude to analyze screenshot and identify clickable UI elements
 * @param imageBuffer Screenshot buffer
 * @param claudeApiKey Anthropic API key
 * @returns Detected UI elements with positions
 */
export async function detectUIElements(imageBuffer: Buffer, claudeApiKey: string): Promise<UIElement[]> {
  try {
    void claudeApiKey;
    const { aiCompletionService } = await import("@/lib/ai/model-router");
    const base64Image = imageBuffer.toString("base64");

    const response = await aiCompletionService.generateText({
      task: "screen_analysis",
      requestedProviderModel:
        process.env.SCREEN_ANALYSIS_MODEL ||
        process.env.NVIDIA_VISION_MODEL ||
        "meta/llama-3.2-11b-vision-instruct",
      hasImageInput: true,
      maxOutputTokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              image: base64Image,
            },
            {
              type: "text",
              text: `Analyze this screenshot and identify all interactive UI elements.
              
For each element, provide:
1. Type (button, text, input, dialog, menu, icon, window, other)
2. Text content or label
3. Approximate position (x, y in pixels from top-left)
4. Size (width, height)
5. Whether it's clickable
6. Confidence (0-1)

Format as JSON array:
[
  {
    "id": "elem_1",
    "type": "button",
    "text": "Click me",
    "x": 100,
    "y": 50,
    "width": 80,
    "height": 40,
    "clickable": true,
    "confidence": 0.95
  },
  ...
]

Only return the JSON array, no other text.`,
            },
          ],
        },
      ],
      timeoutMs: 30_000,
    });

    if (response.aiUnavailable) {
      return [];
    }

    // Parse JSON response
    const jsonMatch = response.text.match(/\[[\s\S]*\]/);
    const parsedElements: unknown = JSON.parse(jsonMatch?.[0] || response.text);
    if (!Array.isArray(parsedElements)) {
      return [];
    }

    // Normalize to UIElement format
    return parsedElements.map(normalizeDetectedElement);
  } catch (err) {
    log.error("UI detection failed:", err);
    // Return empty array on error (graceful degradation)
    return [];
  }
}

/**
 * Get current active window title
 * Uses win32 API (Windows only)
 */
export async function getActiveWindow(): Promise<string> {
  try {
    // For Windows: use get-window-by-handle or similar
    // This is a placeholder - implementation depends on platform
    const windowManager = tryRequire("node-window-manager");
    const loadedWindowManager = getRuntimeModule<WindowManagerModule>(windowManager);

    if (loadedWindowManager) {
      const activeWindow = loadedWindowManager.getActiveWindow?.();
      return activeWindow?.getTitle?.() || "Unknown";
    }

    return "Unknown";
  } catch (err) {
    log.warn("Could not get active window:", err);
    return "Unknown";
  }
}

/**
 * Get current mouse cursor position
 */
export async function getCursorPosition(): Promise<{ x: number; y: number }> {
  try {
    // Try to use robotjs for cursor position
    const robot = getRuntimeModule<RobotModule>(tryRequire("robotjs"));

    if (robot) {
      const pos = robot.getMousePos?.();
      if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
        return pos;
      }
    }

    return { x: 0, y: 0 };
  } catch (err) {
    log.warn("Could not get cursor position:", err);
    return { x: 0, y: 0 };
  }
}

/**
 * Capture full desktop perception
 * This is the main entry point for vision
 * @param analyzeUI Whether to run UI detection (slower but more detailed)
 * @returns Complete screen perception object
 */
export async function capturePerception(analyzeUI: boolean = true, claudeApiKey?: string): Promise<ScreenPerception> {
  const startTime = Date.now();

  try {
    // Capture screenshot
    const screenshotBuffer = await captureScreenshot();

    // Run OCR
    const ocrResult = await performOCR(screenshotBuffer);

    // Detect UI elements (optional, slower)
    let uiElements: UIElement[] = [];
    if (analyzeUI && claudeApiKey) {
      uiElements = await detectUIElements(screenshotBuffer, claudeApiKey);
    }

    // Get metadata
    const activeWindow = await getActiveWindow();
    const cursorPos = await getCursorPosition();

    const perception: ScreenPerception = {
      screenshot: screenshotBuffer,
      timestamp: new Date().toISOString(),
      textContent: ocrResult.text,
      uiElements,
      activeWindow,
      cursorPos,
    };

    log.debug(`Captured perception in ${Date.now() - startTime}ms (${uiElements.length} UI elements)`);
    return perception;
  } catch (err) {
    log.error("Perception capture failed:", err);
    throw err;
  }
}

/**
 * Find UI element by text content
 * Useful for locating buttons/fields by label
 */
export function findElementByText(elements: UIElement[], searchText: string): UIElement | undefined {
  const normalized = searchText.toLowerCase().trim();
  return elements.find((elem) => elem.text.toLowerCase().includes(normalized) && elem.clickable);
}

function normalizeDetectedElement(element: unknown, index: number): UIElement {
  const item = isRecord(element) ? element : {};

  return {
    id: readString(item.id, `elem_${index + 1}`),
    type: normalizeElementType(item.type),
    text: readString(item.text, ""),
    position: {
      x: readFiniteNumber(item.x),
      y: readFiniteNumber(item.y),
      width: readFiniteNumber(item.width),
      height: readFiniteNumber(item.height),
    },
    clickable: readBoolean(item.clickable),
    visible: true,
    confidence: readConfidence(item.confidence),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isTesseractBoundingBox(value: unknown): value is TesseractBoundingBox {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.x0 === "number" &&
    Number.isFinite(value.x0) &&
    typeof value.y0 === "number" &&
    Number.isFinite(value.y0) &&
    typeof value.x1 === "number" &&
    Number.isFinite(value.x1) &&
    typeof value.y1 === "number" &&
    Number.isFinite(value.y1)
  );
}

function readString(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function readFiniteNumber(value: unknown): number {
  const numericValue = readOptionalFiniteNumber(value);
  return numericValue ?? 0;
}

function readOptionalFiniteNumber(value: unknown): number | undefined {
  const numericValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function readBoolean(value: unknown): boolean {
  return value === true || value === "true";
}

function readConfidence(value: unknown): number | undefined {
  const numericValue = readOptionalFiniteNumber(value);
  return numericValue === undefined ? undefined : Math.max(0, Math.min(1, numericValue));
}

function normalizeElementType(value: unknown): UIElement["type"] {
  if (typeof value !== "string") {
    return "other";
  }

  if (
    value === "button" ||
    value === "text" ||
    value === "input" ||
    value === "dialog" ||
    value === "menu" ||
    value === "icon" ||
    value === "window" ||
    value === "other"
  ) {
    return value;
  }

  return "other";
}

/**
 * Find clickable element nearest to coordinate
 */
export function findNearestClickable(
  elements: UIElement[],
  x: number,
  y: number,
  maxDistance: number = 50
): UIElement | undefined {
  let nearest: UIElement | undefined;
  let minDistance = maxDistance;

  for (const elem of elements) {
    if (!elem.clickable) continue;

    const elemCenterX = elem.position.x + elem.position.width / 2;
    const elemCenterY = elem.position.y + elem.position.height / 2;

    const distance = Math.sqrt(Math.pow(elemCenterX - x, 2) + Math.pow(elemCenterY - y, 2));

    if (distance < minDistance) {
      minDistance = distance;
      nearest = elem;
    }
  }

  return nearest;
}
