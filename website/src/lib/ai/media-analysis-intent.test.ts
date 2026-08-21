import assert from "node:assert/strict";
import test from "node:test";

import {
  detectMediaAnalysisIntent,
  extractFirstPublicUrl,
  inferMediaAnalysisType,
} from "./media-analysis-intent.ts";

test("detects YouTube summary requests", () => {
  const intent = detectMediaAnalysisIntent(
    "summarize this YouTube video https://youtu.be/abc123?si=test"
  );

  assert.equal(intent?.task, "summarize");
  assert.equal(intent?.mediaType, "youtube");
  assert.equal(intent?.url, "https://youtu.be/abc123?si=test");
});

test("detects public audio transcription requests", () => {
  const intent = detectMediaAnalysisIntent(
    "transcribe this podcast audio https://example.com/episode.mp3."
  );

  assert.equal(intent?.task, "transcribe");
  assert.equal(intent?.mediaType, "audio");
  assert.equal(intent?.url, "https://example.com/episode.mp3");
});

test("removes the matched media url from cleaned prompts", () => {
  const intent = detectMediaAnalysisIntent(
    "please summarize this video https://example.com/episode.mp4."
  );

  assert.equal(intent?.prompt, "summarize this video");
});

test("does not hijack normal web page summaries", () => {
  assert.equal(
    detectMediaAnalysisIntent("summarize this article https://example.com/post"),
    null
  );
});

test("infers media types from URLs and surrounding text", () => {
  assert.equal(
    inferMediaAnalysisType("https://www.youtube.com/watch?v=abc", ""),
    "youtube"
  );
  assert.equal(inferMediaAnalysisType("https://example.com/file.webm", ""), "video");
  assert.equal(
    inferMediaAnalysisType("https://example.com/page", "analyze this podcast"),
    "audio"
  );
});

test("extractFirstPublicUrl strips trailing punctuation", () => {
  assert.equal(
    extractFirstPublicUrl("watch https://example.com/video.mp4, thanks"),
    "https://example.com/video.mp4"
  );
});

test("extractFirstPublicUrl rejects malformed urls", () => {
  assert.equal(extractFirstPublicUrl("watch https://."), null);
  assert.equal(extractFirstPublicUrl("watch https://"), null);
});
