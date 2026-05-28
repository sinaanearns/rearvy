import test from "node:test";
import assert from "node:assert/strict";

import { normalizeWorkTaskInput } from "./tasks";

test("normalizeWorkTaskInput tracks completion and archive timestamps", () => {
  const created = normalizeWorkTaskInput({
    title: "  Ship parity work  ",
    priority: "high",
    tags: ["work", "work", "parity"],
  });

  assert.equal(created.title, "Ship parity work");
  assert.equal(created.priority, "high");
  assert.deepEqual(created.tags, ["work", "parity"]);

  const completed = normalizeWorkTaskInput({ status: "completed" }, { id: "task_1", ...created });
  assert.equal(completed.status, "completed");
  assert.match(String(completed.completed_at), /^\d{4}-\d{2}-\d{2}T/);

  const archived = normalizeWorkTaskInput({ status: "archived" }, { id: "task_1", ...completed });
  assert.equal(archived.status, "archived");
  assert.match(String(archived.archived_at), /^\d{4}-\d{2}-\d{2}T/);
});
