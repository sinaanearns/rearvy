/**
 * Vision Layer - Screenshot Capture & Analysis
 * Handles: screenshot capture, OCR, UI element detection
 */

import { ScreenPerception, UIElement, OCRResult } from "./types";

// Platform-specific imports (lazy loaded)
let screenshot: any;

// Safe runtime require helper to avoid static bundlers resolving native modules
function tryRequire(name: string) {
  try {
    // @ts-ignore
    return require(name);
  } catch (e) {
    try {
      // eslint-disable-next-line no-eval
      return eval("require")(name);
    } catch (e2) {
      return null;
    }
  }
}

/**
 * Initialize vision layer dependencies
 * This runs once on startup to load native modules
 */
export async function initializeVisionLayer(): Promise<void> {
  try {
    // Try to load screenshot library
    // Using 'screenshot-desktop' package for cross-platform support
    const s = tryRequire("screenshot-desktop");
    if (s) screenshot = s.default || s;
  } catch (err) {
    console.warn("screenshot-desktop not installed. Using fallback.", err);
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

    // screenshot-desktop returns png as Buffer
    const img = await screenshot();
    if (!img) {
      throw new Error("Screenshot returned null");
    }

    // Ensure it's a Buffer
    if (typeof img === "string") {
      return Buffer.from(img, "base64");
    }
    return img as Buffer;
  } catch (err) {
    console.error("Failed to capture screenshot:", err);
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
    console.error("OCR failed:", err);
    throw new Error(`OCR failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Extract bounding boxes from Tesseract result
 * @internal
 */
function extractBoundingBoxes(
  data: any
): Array<{ text: string; box: { x: number; y: number; width: number; height: number } }> {
  const boxes: Array<{ text: string; box: { x: number; y: number; width: number; height: number } }> = [];

  if (!data.words) {
    return boxes;
  }

  for (const word of data.words) {
    boxes.push({
      text: word.text,
      box: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0,
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
    const Anthropic = await import("@anthropic-ai/sdk");
    const client = new Anthropic.default({ apiKey: claudeApiKey });

    const base64Image = imageBuffer.toString("base64");

    const response = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: base64Image,
              },
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
    });

    const content = response.content[0];
    if (content.type !== "text") {
      throw new Error("Unexpected response format from Claude");
    }

    // Parse JSON response
    const elements = JSON.parse(content.text);

    // Normalize to UIElement format
    return elements.map((elem: any) => ({
      id: elem.id,
      type: elem.type,
      text: elem.text || "",
      position: {
        x: elem.x,
        y: elem.y,
        width: elem.width,
        height: elem.height,
      },
      clickable: elem.clickable,
      visible: true,
      confidence: elem.confidence,
    }));
  } catch (err) {
    console.error("UI detection failed:", err);
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

    if (windowManager) {
      const activeWindow = (windowManager as any).getActiveWindow?.();
      return activeWindow?.getTitle?.() || "Unknown";
    }

    return "Unknown";
  } catch (err) {
    console.warn("Could not get active window:", err);
    return "Unknown";
  }
}

/**
 * Get current mouse cursor position
 */
export async function getCursorPosition(): Promise<{ x: number; y: number }> {
  try {
    // Try to use robotjs for cursor position
    const robot = tryRequire("robotjs");

    if (robot) {
      const pos = (robot as any).getMousePos();
      return pos;
    }

    return { x: 0, y: 0 };
  } catch (err) {
    console.warn("Could not get cursor position:", err);
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

    console.log(`[Vision] Captured perception in ${Date.now() - startTime}ms (${uiElements.length} UI elements)`);
    return perception;
  } catch (err) {
    console.error("Perception capture failed:", err);
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
