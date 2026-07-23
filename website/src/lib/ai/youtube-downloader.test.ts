import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYouTubeVideoId,
  resolveSaveFromDownloadUrl,
} from "./youtube-downloader.ts";

test("extracts YouTube IDs from supported reference URL forms", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
  assert.equal(
    extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=4"),
    "dQw4w9WgXcQ"
  );
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    "dQw4w9WgXcQ"
  );
  assert.equal(
    extractYouTubeVideoId("https://example.com/youtu.be/dQw4w9WgXcQ"),
    null
  );
});

test("accepts a video strictly as a planning reference without a download URL", async () => {
  const result = await resolveSaveFromDownloadUrl({
    youtubeUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  });

  assert.equal(result.success, true);
  assert.equal(result.sourceUseMode, "reference_only");
  assert.equal(result.referenceUrl, result.youtubeUrl);
  assert.equal(result.downloadUrl, undefined);
  assert.match(result.message ?? "", /original assets/i);
});
