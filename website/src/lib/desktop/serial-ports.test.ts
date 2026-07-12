import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeDesktopSerialPortListResult } from "./serial-ports";

test("normalizes successful structured responses", () => {
  assert.deepEqual(
    normalizeDesktopSerialPortListResult({ ok: true, ports: [] }),
    { ok: true, ports: [] }
  );

  assert.deepEqual(
    normalizeDesktopSerialPortListResult({ ok: true, ports: [{ path: "COM7" }] }),
    { ok: true, ports: [{ path: "COM7" }] }
  );
});

test("remains compatible with the legacy raw-array response", () => {
  assert.deepEqual(normalizeDesktopSerialPortListResult([{ path: "COM7" }]), {
    ok: true,
    ports: [{ path: "COM7" }],
  });
});

test("keeps structured failures specific and never collapses them to unavailable", () => {
  assert.deepEqual(
    normalizeDesktopSerialPortListResult({
      ok: false,
      ports: [],
      message: "Serial ports are blocked in this environment.",
    }),
    {
      ok: false,
      ports: [],
      message: "Serial ports are blocked in this environment.",
    }
  );

  assert.deepEqual(normalizeDesktopSerialPortListResult(undefined), {
    ok: false,
    ports: [],
    message: "Device bridge returned an invalid response.",
  });
});
