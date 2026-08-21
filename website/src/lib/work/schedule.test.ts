import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextCronRunAt,
  isCronDueAt,
  normalizeWorkSchedule,
  parseCronExpression,
} from "./schedule";

test("parseCronExpression supports ranges, steps, and lists", () => {
  const parsed = parseCronExpression("*/15 8-18 * * 1,3,5");

  assert.equal(parsed.fields.minute.has(0), true);
  assert.equal(parsed.fields.minute.has(15), true);
  assert.equal(parsed.fields.hour.has(18), true);
  assert.equal(parsed.fields.dayOfWeek.has(3), true);
  assert.equal(parsed.fields.dayOfWeek.has(2), false);
});

test("getNextCronRunAt calculates the next matching run in timezone", () => {
  const next = getNextCronRunAt(
    "30 9 * * 1-5",
    "UTC",
    new Date("2026-05-25T09:29:10.000Z")
  );

  assert.equal(next, "2026-05-25T09:30:00.000Z");
});

test("isCronDueAt handles weekday schedules", () => {
  assert.equal(isCronDueAt("0 9 * * 1-5", "UTC", new Date("2026-05-25T09:00:00.000Z")), true);
  assert.equal(isCronDueAt("0 9 * * 1-5", "UTC", new Date("2026-05-24T09:00:00.000Z")), false);
});

test("normalizeWorkSchedule falls back to weekdays for invalid cron", () => {
  assert.deepEqual(normalizeWorkSchedule("not cron"), {
    schedule: "0 9 * * 1-5",
    label: "Weekdays at 09:00",
  });
});

