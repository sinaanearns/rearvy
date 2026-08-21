import assert from "node:assert/strict";
import test from "node:test";
import { getCalendarEvents, createCalendarEvent, updateCalendarEvent, findFreeTime } from "./calendar";

test("calendar tools exports are valid functions", () => {
  assert.equal(typeof getCalendarEvents, "function");
  assert.equal(typeof createCalendarEvent, "function");
  assert.equal(typeof updateCalendarEvent, "function");
  assert.equal(typeof findFreeTime, "function");
});
