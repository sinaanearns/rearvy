import assert from "node:assert/strict";
import test from "node:test";
import { buildDaVinciFcpxml } from "./davinci-timeline-builder.ts";

test("escapes FCPXML values and encodes Windows asset paths", () => {
  const xml = buildDaVinciFcpxml({
    title: 'A&B "Launch"',
    clips: [
      {
        sceneIndex: 1,
        fileName: "frame&1.png",
        filePath: "C:\\Users\\Public Desktop\\Asset 1.png",
        durationSeconds: 2,
        startFrame: 0,
        endFrame: 60,
        onScreenText: "<Original>",
      },
    ],
  });

  assert.match(xml, /name="A&amp;B &quot;Launch&quot;"/);
  assert.match(xml, /name="frame&amp;1\.png"/);
  assert.match(xml, /<note>&lt;Original&gt;<\/note>/);
  assert.match(xml, /file:\/\/\/C:\/Users\/Public%20Desktop\/Asset%201\.png/);
});
