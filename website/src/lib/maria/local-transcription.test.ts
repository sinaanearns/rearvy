import { test } from 'node:test';
import assert from 'assert';
import { probeLocalMariaVoiceService } from './local-transcription';

// Simulate a secure hosted page without the desktop bridge.
// The implementation should short-circuit and return ok: false.
(globalThis as any).window = { location: { protocol: 'https:' } } as any;

test('probe short-circuits on secure context without bridge', async () => {
  const res = await probeLocalMariaVoiceService();
  assert.strictEqual(res.ok, false, 'probe should be false when secure and no bridge');
});
