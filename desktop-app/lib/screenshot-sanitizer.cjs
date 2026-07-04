/**
 * ScreenshotSanitizer
 *
 * Automatically masks sensitive input fields (password, credit card,
 * OTP, etc.) in screenshots before they are sent to the AI or logged.
 *
 * Per AGENTS.md §5:
 *   "Auto-mask password entries and sensitive tokens in screenshot frames
 *    and logging payloads."
 *
 * Strategy:
 *   1. Detect `<input type="password">` and known sensitive field patterns
 *      via accessibility element metadata provided by the WorkflowExecutor.
 *   2. Draw solid black rectangles over their bounding boxes in the image.
 *   3. Return the sanitized image.
 *
 * Since we work with base64-encoded PNG data URLs in the Electron main
 * process (no DOM access), we use a heuristic element-list approach:
 * the caller provides bounding rects of sensitive fields, and we paint
 * over them using the `jimp` package (bundled with the desktop-app).
 */

"use strict";

const { createLogger } = require("./logger.cjs");

const log = createLogger("ScreenshotSanitizer");

/**
 * Checks whether a UI element descriptor represents a sensitive field
 * that should be masked.
 *
 * @param {{ role?: string; type?: string; name?: string; label?: string }} element
 * @returns {boolean}
 */
function isSensitiveElement(element) {
  if (!element) return false;

  const role = (element.role || "").toLowerCase();
  const type = (element.type || "").toLowerCase();
  const name = (element.name || "").toLowerCase();
  const label = (element.label || "").toLowerCase();

  // Direct password/secret input types
  if (type === "password") return true;

  // ARIA roles
  if (role === "password-input" || role === "secret") return true;

  // Common field name patterns
  const sensitiveNamePatterns = [
    "password", "passwd", "pass", "secret", "token", "otp",
    "cvv", "cvc", "card-number", "cardnumber", "creditcard",
    "ssn", "social-security", "pin", "private-key",
  ];

  for (const pattern of sensitiveNamePatterns) {
    if (name.includes(pattern) || label.includes(pattern)) return true;
  }

  return false;
}

/**
 * Given an array of element descriptors, returns only the sensitive ones
 * along with their bounding rectangles.
 *
 * @param {Array<{ role?: string; type?: string; name?: string; label?: string; bounds?: { x: number; y: number; width: number; height: number } }>} elements
 * @returns {Array<{ x: number; y: number; width: number; height: number }>}
 */
function getSensitiveBounds(elements) {
  if (!Array.isArray(elements)) return [];
  return elements
    .filter((el) => isSensitiveElement(el) && el.bounds)
    .map((el) => el.bounds);
}

/**
 * Sanitizes a base64 PNG data URL by overlaying black rectangles
 * on the given bounding boxes.
 *
 * Falls back gracefully if jimp is unavailable (returns the original
 * image unchanged but logs a warning).
 *
 * @param {string} dataUrl  - base64 PNG data URL ("data:image/png;base64,...")
 * @param {Array<{ x: number; y: number; width: number; height: number }>} sensitiveRects
 * @returns {Promise<string>} Sanitized data URL.
 */
async function sanitizeScreenshot(dataUrl, sensitiveRects) {
  if (!dataUrl || !sensitiveRects || sensitiveRects.length === 0) {
    return dataUrl;
  }

  let Jimp;
  try {
    Jimp = require("jimp");
  } catch {
    log.warn(
      "jimp not available — screenshot sanitizer cannot mask sensitive fields. " +
      "Install jimp in desktop-app to enable masking."
    );
    return dataUrl;
  }

  try {
    // Strip data URL prefix
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, "base64");

    const image = await Jimp.read(buffer);

    for (const rect of sensitiveRects) {
      const { x, y, width, height } = rect;
      if (width > 0 && height > 0) {
        // Paint a solid black rectangle
        image.scan(x, y, width, height, function (px, py, idx) {
          this.bitmap.data[idx + 0] = 0;   // R
          this.bitmap.data[idx + 1] = 0;   // G
          this.bitmap.data[idx + 2] = 0;   // B
          this.bitmap.data[idx + 3] = 255; // A (fully opaque)
        });
      }
    }

    const sanitizedBuffer = await image.getBufferAsync(Jimp.MIME_PNG);
    return `data:image/png;base64,${sanitizedBuffer.toString("base64")}`;
  } catch (err) {
    log.error("Failed to sanitize screenshot:", err);
    // Return original rather than crashing the automation pipeline
    return dataUrl;
  }
}

/**
 * Convenience wrapper: given a screenshot data URL and the full element
 * list from the current page, returns a sanitized screenshot.
 *
 * @param {string} dataUrl
 * @param {Array<object>} elements  - Raw UI element array from WorkflowExecutor
 * @returns {Promise<string>}
 */
async function sanitizeScreenshotWithElements(dataUrl, elements) {
  const rects = getSensitiveBounds(elements);
  if (rects.length > 0) {
    log.info(`Masking ${rects.length} sensitive field(s) in screenshot`);
  }
  return sanitizeScreenshot(dataUrl, rects);
}

module.exports = {
  isSensitiveElement,
  getSensitiveBounds,
  sanitizeScreenshot,
  sanitizeScreenshotWithElements,
};
