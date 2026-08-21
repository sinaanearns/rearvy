import { createServerLogger } from "@/lib/server-logger";

const log = createServerLogger("DaVinciTimelineBuilder");

export interface TimelineClipItem {
  sceneIndex: number;
  fileName: string;
  filePath: string;
  durationSeconds: number;
  startFrame: number;
  endFrame: number;
  onScreenText?: string;
  prompt?: string;
}

export interface DaVinciTimelineOptions {
  title?: string;
  fps?: number;
  clips: TimelineClipItem[];
}

function escapeXml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeFcpxmlFileUrl(filePath: string) {
  const normalizedPath = filePath.replace(/\\/g, "/");
  const withLeadingSlash = /^[a-z]:/i.test(normalizedPath)
    ? `/${normalizedPath}`
    : normalizedPath;
  return `file://${encodeURI(withLeadingSlash)}`;
}

/**
 * Builds a standard Final Cut Pro XML (FCPXML v1.8) string compatible with DaVinci Resolve.
 * Importing this file into DaVinci Resolve automatically loads all frame image assets
 * onto the timeline with exact durations.
 */
export function buildDaVinciFcpxml(options: DaVinciTimelineOptions): string {
  const { title = "Rearvy Recreated Video", fps = 30, clips } = options;
  log.info(`Building DaVinci FCPXML timeline "${title}" with ${clips.length} clips at ${fps} fps`);

  let totalDurationFrames = 0;
  const clipElements = clips
    .map((clip, index) => {
      const durationFrames = Math.max(30, Math.round((clip.durationSeconds || 5) * fps));
      const startFrame = totalDurationFrames;
      totalDurationFrames += durationFrames;

      return `
        <asset-clip name="${escapeXml(clip.fileName)}" offset="${startFrame}/${fps}s" ref="r${index + 1}" duration="${durationFrames}/${fps}s" start="0/1s">
          <note>${escapeXml(clip.onScreenText || clip.prompt || "")}</note>
        </asset-clip>`;
    })
    .join("");

  const assetElements = clips
    .map(
      (clip, index) => `
    <asset id="r${index + 1}" name="${escapeXml(clip.fileName)}" src="${escapeXml(normalizeFcpxmlFileUrl(clip.filePath))}" format="r0" hasVideo="1" />`
    )
    .join("");

  const safeTitle = escapeXml(title);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE fcpxml>
<fcpxml version="1.8">
  <resources>
    <format id="r0" name="FFVideoFormat1080p${fps}" frameDuration="1/${fps}s" width="1920" height="1080" />${assetElements}
  </resources>
  <library>
    <event name="${safeTitle}">
      <project name="${safeTitle}">
        <sequence format="r0" duration="${totalDurationFrames}/${fps}s">
          <spine>${clipElements}
          </spine>
        </sequence>
      </project>
    </event>
  </library>
</fcpxml>`;
}

/**
 * Builds a Edit Decision List (EDL CMX 3600) string for legacy video editor compatibility.
 */
export function buildDaVinciEdl(options: DaVinciTimelineOptions): string {
  const { title = "REARVY_TIMELINE", fps = 30, clips } = options;

  function toTimecode(frameNumber: number): string {
    const totalSecs = Math.floor(frameNumber / fps);
    const frames = frameNumber % fps;
    const hrs = Math.floor(totalSecs / 3600);
    const mins = Math.floor((totalSecs % 3600) / 60);
    const secs = totalSecs % 60;

    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
  }

  let currentFrame = 0;
  let edlText = `TITLE: ${title.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}\nFCM: NON-DROP FRAME\n\n`;

  clips.forEach((clip, index) => {
    const durationFrames = Math.max(30, Math.round((clip.durationSeconds || 5) * fps));
    const srcIn = toTimecode(0);
    const srcOut = toTimecode(durationFrames);
    const recIn = toTimecode(currentFrame);
    currentFrame += durationFrames;
    const recOut = toTimecode(currentFrame);

    const eventNum = String(index + 1).padStart(3, "0");
    edlText += `${eventNum}  AX       V     C        ${srcIn} ${srcOut} ${recIn} ${recOut}\n`;
    edlText += `* FROM CLIP: ${clip.fileName}\n\n`;
  });

  return edlText;
}
