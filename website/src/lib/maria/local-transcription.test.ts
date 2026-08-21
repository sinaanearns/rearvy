import { test } from 'node:test';
import assert from 'assert';
import { probeLocalMariaVoiceService } from './local-transcription';

// Simulate a secure hosted page without the desktop bridge.
// The implementation should short-circuit and return ok: false.
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'window');

test.before(() => {
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: { location: { protocol: 'https:' } },
  });
});

test.after(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, 'window', originalWindowDescriptor);
  } else {
    delete (globalThis as { window?: unknown }).window;
  }
});

test('probe short-circuits on secure context without bridge', async () => {
  const res = await probeLocalMariaVoiceService();
  assert.strictEqual(res.ok, false, 'probe should be false when secure and no bridge');
});
