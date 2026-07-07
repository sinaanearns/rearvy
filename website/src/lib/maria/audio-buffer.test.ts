import assert from "node:assert/strict";
import test from "node:test";
import { AudioBuffer, mergeArrayBuffers } from "./audio-buffer";

test("mergeArrayBuffers concatenates correctly", () => {
  const a = new Uint8Array([1, 2, 3]).buffer;
  const b = new Uint8Array([4, 5, 6]).buffer;
  const merged = new Uint8Array(mergeArrayBuffers([a, b]));
  assert.deepEqual(Array.from(merged), [1, 2, 3, 4, 5, 6]);
});

test("AudioBuffer flushes on threshold", async () => {
  const received: ArrayBuffer[] = [];
  const buf = new AudioBuffer({
    flushThresholdBytes: 4,
    onFlush: async (data) => { received.push(data); },
  });

  await buf.append(new Uint8Array([1, 2]).buffer);
  await buf.append(new Uint8Array([3, 4]).buffer);

  assert.equal(received.length, 1);
  assert.equal(new Uint8Array(received[0]).length, 4);
});

test("AudioBuffer flush forces emit", async () => {
  const received: ArrayBuffer[] = [];
  const buf = new AudioBuffer({
    flushThresholdBytes: 1000,
    onFlush: async (data) => { received.push(data); },
  });

  await buf.append(new Uint8Array([9]).buffer);
  assert.equal(received.length, 0);
  await buf.flush();
  assert.equal(received.length, 1);
});
