import test from "node:test";
import assert from "node:assert/strict";

import { buildDiarySummary } from "./diary";

test("buildDiarySummary summarizes tasks, runs, and source research", () => {
  const summary = buildDiarySummary({
    completedTasks: [{ title: "Finish Work Platform tasks" }],
    completedRuns: [{ task: "Daily report", source: "work_automation" }],
    sourceTasks: [{ query: "Alibaba supplier scan", status: "completed" }],
  });

  assert.equal(summary.metrics.completedTasks, 1);
  assert.equal(summary.metrics.completedRuns, 1);
  assert.equal(summary.metrics.sourceTasks, 1);
  assert.match(summary.summary, /Finish Work Platform tasks/);
});
