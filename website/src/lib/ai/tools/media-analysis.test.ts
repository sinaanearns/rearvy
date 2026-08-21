import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMediaAnalysisFallbackSummary,
  extractYouTubeVideoId,
  normalizePublicMediaUrl,
  shouldAttemptAssemblyUrlTranscription,
} from "./media-analysis.ts";

test("extractYouTubeVideoId handles common YouTube URL shapes", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=abc123&feature=share"),
    "abc123"
  );
  assert.equal(extractYouTubeVideoId("https://youtu.be/shortId"), "shortId");
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/shorts/shortsId"),
    "shortsId"
  );
});

test("normalizePublicMediaUrl only accepts http and https urls", () => {
  assert.equal(
    normalizePublicMediaUrl(" https://example.com/video.mp4 "),
    "https://example.com/video.mp4"
  );
  assert.equal(normalizePublicMediaUrl("http://example.com/page"), "http://example.com/page");
  assert.equal(normalizePublicMediaUrl("mailto:hello@example.com"), null);
  assert.equal(normalizePublicMediaUrl("javascript:alert(1)"), null);
  assert.equal(normalizePublicMediaUrl("example.com/video.mp4"), null);
});

test("buildMediaAnalysisFallbackSummary uses public evidence and flags missing transcript", () => {
  const summary = buildMediaAnalysisFallbackSummary({
    task: "transcribe",
    mediaType: "youtube",
    prompt: "transcribe this video",
    metadata: {
      title: "Launch interview",
      authorName: "Rearvy",
      providerName: "YouTube",
    },
    page: {
      ok: true,
      title: "Launch interview",
      url: "https://youtube.com/watch?v=abc",
      source: "youtube.com",
      content: "A page description with public context.",
    },
  });

  assert.match(summary, /Launch interview/);
  assert.match(summary, /Readable context/);
  assert.match(summary, /verified transcript was not available/i);
});

test("shouldAttemptAssemblyUrlTranscription only accepts direct media file URLs", () => {
  assert.equal(
    shouldAttemptAssemblyUrlTranscription({
      task: "transcribe",
      mediaType: "audio",
      url: "https://example.com/episode.mp3",
    }),
    true
  );
  assert.equal(
    shouldAttemptAssemblyUrlTranscription({
      task: "transcribe",
      mediaType: "youtube",
      url: "https://youtube.com/watch?v=abc",
    }),
    false
  );
  assert.equal(
    shouldAttemptAssemblyUrlTranscription({
      task: "summarize",
      mediaType: "video",
      url: "https://example.com/video.mp4",
    }),
    false
  );
});
