import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCuesFromPlainText,
  buildCuesFromWordTokens,
  formatDaVinciSubtitleScript,
  formatSrt,
  formatSrtTimestamp,
  formatVtt,
  formatVttTimestamp,
  generateSubtitlesFromTranscript,
  type SubtitleCue,
  type SubtitleWordToken,
} from "../subtitles-generator.ts";

// --- Timestamp formatters ---

test("formatSrtTimestamp: formats zero milliseconds", () => {
  assert.equal(formatSrtTimestamp(0), "00:00:00,000");
});

test("formatSrtTimestamp: formats 1 hour 23 minutes 45 seconds 678 ms", () => {
  const ms = 1 * 3600000 + 23 * 60000 + 45 * 1000 + 678;
  assert.equal(formatSrtTimestamp(ms), "01:23:45,678");
});

test("formatSrtTimestamp: clamps negative values to 0", () => {
  assert.equal(formatSrtTimestamp(-100), "00:00:00,000");
});

test("formatVttTimestamp: uses period instead of comma", () => {
  const ms = 2 * 60000 + 5000 + 300;
  assert.equal(formatVttTimestamp(ms), "00:02:05.300");
});

// --- SRT output ---

test("formatSrt: produces correct SRT cue structure", () => {
  const cues: SubtitleCue[] = [
    { index: 1, startTimeMs: 0, endTimeMs: 2000, text: "Hello world" },
    { index: 2, startTimeMs: 2080, endTimeMs: 4000, text: "This is Rearvy." },
  ];
  const srt = formatSrt(cues);
  assert.ok(srt.includes("1\n00:00:00,000 --> 00:00:02,000\nHello world"));
  assert.ok(srt.includes("2\n00:00:02,080 --> 00:00:04,000\nThis is Rearvy."));
});

test("formatSrt: includes speaker label when provided", () => {
  const cues: SubtitleCue[] = [
    { index: 1, startTimeMs: 0, endTimeMs: 2000, text: "Hi there", speaker: "Speaker A" },
  ];
  const srt = formatSrt(cues);
  assert.ok(srt.includes("[Speaker A]: Hi there"));
});

// --- VTT output ---

test("formatVtt: starts with WEBVTT header", () => {
  const cues: SubtitleCue[] = [{ index: 1, startTimeMs: 500, endTimeMs: 2500, text: "Test cue" }];
  const vtt = formatVtt(cues);
  assert.ok(vtt.startsWith("WEBVTT"));
});

test("formatVtt: wraps speaker in <v> tag", () => {
  const cues: SubtitleCue[] = [
    { index: 1, startTimeMs: 0, endTimeMs: 1000, text: "Hello", speaker: "John" },
  ];
  const vtt = formatVtt(cues);
  assert.ok(vtt.includes("<v John>Hello</v>"));
});

// --- Plain text cue building ---

test("buildCuesFromPlainText: creates cues from simple paragraph", () => {
  const text = "Hello world. How are you today? I am doing great!";
  const cues = buildCuesFromPlainText(text);
  assert.ok(cues.length > 0);
  for (const cue of cues) {
    assert.ok(cue.index > 0);
    assert.ok(cue.endTimeMs > cue.startTimeMs);
    assert.ok(cue.text.trim().length > 0);
  }
});

test("buildCuesFromPlainText: respects maxCharsPerLine and maxLines", () => {
  const text =
    "This is a very long sentence that should be split into multiple lines when it exceeds the character per line limit.";
  const cues = buildCuesFromPlainText(text, { maxCharsPerLine: 37, maxLines: 2 });
  for (const cue of cues) {
    const lines = cue.text.split("\n");
    assert.ok(lines.length <= 2);
    for (const line of lines) {
      assert.ok(line.length <= 37);
    }
  }
});

test("buildCuesFromPlainText: sequential timestamps do not overlap", () => {
  const text = "First sentence. Second sentence. Third sentence.";
  const cues = buildCuesFromPlainText(text);
  for (let i = 1; i < cues.length; i++) {
    assert.ok(cues[i].startTimeMs >= cues[i - 1].endTimeMs);
  }
});

// --- Word token cue building ---

const SAMPLE_TOKENS: SubtitleWordToken[] = [
  { word: "Hello", startMs: 0, endMs: 500 },
  { word: "world.", startMs: 600, endMs: 1000 },
  { word: "How", startMs: 1100, endMs: 1400 },
  { word: "are", startMs: 1500, endMs: 1700 },
  { word: "you?", startMs: 1800, endMs: 2200 },
];

test("buildCuesFromWordTokens: flushes on sentence-ending punctuation", () => {
  const cues = buildCuesFromWordTokens(SAMPLE_TOKENS);
  assert.ok(cues.some((c: SubtitleCue) => c.text.includes("Hello world.")));
  assert.ok(cues.some((c: SubtitleCue) => c.text.includes("How are you?")));
});

test("buildCuesFromWordTokens: cue indices start at 1 and are sequential", () => {
  const cues = buildCuesFromWordTokens(SAMPLE_TOKENS);
  cues.forEach((cue: SubtitleCue, i: number) => {
    assert.equal(cue.index, i + 1);
  });
});

test("buildCuesFromWordTokens: respects minimum duration", () => {
  const shortTokens: SubtitleWordToken[] = [{ word: "Hi.", startMs: 0, endMs: 100 }];
  const cues = buildCuesFromWordTokens(shortTokens, { minDurationMs: 1000 });
  assert.ok(cues[0].endTimeMs - cues[0].startTimeMs >= 1000);
});

test("buildCuesFromWordTokens: respects speaker diarization", () => {
  const speakerTokens: SubtitleWordToken[] = [
    { word: "Hi,", startMs: 0, endMs: 300, speaker: "A" },
    { word: "there.", startMs: 400, endMs: 700, speaker: "A" },
    { word: "Hello.", startMs: 800, endMs: 1200, speaker: "B" },
  ];
  const cues = buildCuesFromWordTokens(speakerTokens, { speakerDiarization: true });
  const speakerACue = cues.find((c: SubtitleCue) => c.speaker === "A");
  const speakerBCue = cues.find((c: SubtitleCue) => c.speaker === "B");
  assert.ok(speakerACue !== undefined);
  assert.ok(speakerBCue !== undefined);
});

// --- DaVinci Resolve script generation ---

test("formatDaVinciSubtitleScript: produces valid Python script with cue data", () => {
  const cues: SubtitleCue[] = [{ index: 1, startTimeMs: 0, endTimeMs: 3000, text: "Hello Resolve." }];
  const script = formatDaVinciSubtitleScript(cues, { fps: 24 });
  assert.ok(script.includes("#!/usr/bin/env python"));
  assert.ok(script.includes("DaVinciResolveScript"));
  assert.ok(script.includes("Hello Resolve."));
  assert.ok(script.includes("24"));
});

// --- End-to-end generation ---

test("generateSubtitlesFromTranscript: generates SRT, VTT, and DaVinci script from plain text", () => {
  const result = generateSubtitlesFromTranscript({
    text: "This is a test transcript. It has multiple sentences.",
  });
  assert.ok(result.cues.length > 0);
  assert.ok(result.srt.includes("00:00:"));
  assert.ok(result.vtt.startsWith("WEBVTT"));
  assert.ok(result.daVinciScript.includes("Rearvy"));
});

test("generateSubtitlesFromTranscript: generates from word tokens when provided", () => {
  const tokens: SubtitleWordToken[] = [{ word: "Test.", startMs: 0, endMs: 1000 }];
  const result = generateSubtitlesFromTranscript({ wordTokens: tokens });
  assert.equal(result.cues.length, 1);
  assert.equal(result.cues[0].text, "Test.");
});
