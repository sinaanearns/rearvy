const fs = require("fs/promises");
const path = require("path");
const os = require("os");
const { createLogger } = require("./logger.cjs");

const log = createLogger("VideoFrameAnalyzer");

async function analyzeReferenceVideo(options = {}) {
  const {
    topic = "Rearvy Promo",
    niche = "AI Operating System",
    frames = [],
    referenceUrl,
    sourceUseMode = "reference_only",
    apiBaseUrl = "http://localhost:3000",
    authorizationToken,
  } = options;

  log.info(`Analyzing video reference for topic: "${topic}" (${frames.length} frames)`);

  try {
    const fetchFn = typeof fetch === "function" ? fetch : require("node-fetch");
    const response = await fetchFn(`${apiBaseUrl}/api/ai/video-frame-analysis`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(typeof authorizationToken === "string" && authorizationToken.trim()
          ? { Authorization: `Bearer ${authorizationToken.trim()}` }
          : {}),
      },
      body: JSON.stringify({
        topic,
        targetNiche: niche,
        frames,
        referenceUrl,
        sourceUseMode,
      }),
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || `Frame analysis API returned HTTP ${response.status}.`);
    }

    if (data?.success && Array.isArray(data.shots)) {
      return data;
    }

    throw new Error(data?.error || "Frame analysis API returned an invalid response.");
  } catch (error) {
    const message = error?.message || String(error);
    log.warn("Frame analysis failed:", message);
    return {
      success: false,
      topic,
      totalFramesAnalyzed: frames.length,
      shots: [],
      overallStyle: "",
      error: `Frame analysis requires a running Rearvy web server with configured NVIDIA models. ${message}`,
    };
  }
}

async function saveGeneratedFrameAsset(targetDir, fileName, imageBufferOrBase64) {
  try {
    const assetsDir = path.join(targetDir, "assets");
    await fs.mkdir(assetsDir, { recursive: true });

    const safeFileName = path.basename(String(fileName || "")).replace(/[^\w.-]+/g, "_");
    if (!safeFileName || !/\.(?:png|jpe?g|webp)$/i.test(safeFileName)) {
      throw new Error("Generated frame asset fileName must end with .png, .jpg, .jpeg, or .webp.");
    }

    const filePath = path.join(assetsDir, safeFileName);
    let buffer;
    if (Buffer.isBuffer(imageBufferOrBase64)) {
      buffer = imageBufferOrBase64;
    } else if (typeof imageBufferOrBase64 === "string") {
      const base64Data = imageBufferOrBase64
        .trim()
        .replace(/^data:image\/(?:png|jpe?g|webp);base64,/i, "");
      if (!/^[a-z0-9+/=\s]+$/i.test(base64Data)) {
        throw new Error("Invalid base64 image payload.");
      }
      buffer = Buffer.from(base64Data, "base64");
    } else {
      throw new Error("Invalid image payload provided to saveGeneratedFrameAsset.");
    }

    await fs.writeFile(filePath, buffer);
    log.info(`Saved generated frame asset to: ${filePath}`);
    return filePath;
  } catch (error) {
    log.error(`Failed to save generated frame asset "${fileName}":`, error);
    throw error;
  }
}

function getDefaultProjectDirectory() {
  const userDesktop = path.join(os.homedir(), "Desktop");
  return path.join(userDesktop, "Rearvy_Promo_Project");
}

module.exports = {
  analyzeReferenceVideo,
  saveGeneratedFrameAsset,
  getDefaultProjectDirectory,
};
