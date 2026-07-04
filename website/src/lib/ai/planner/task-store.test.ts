import assert from "node:assert/strict";
import test from "node:test";
import { taskStore } from "./task-store";

test("taskStore defines expected CRUD interface", () => {
  assert.equal(typeof taskStore.createTask, "function");
  assert.equal(typeof taskStore.getTask, "function");
  assert.equal(typeof taskStore.setPlan, "function");
  assert.equal(typeof taskStore.updateStatus, "function");
  assert.equal(typeof taskStore.updateStep, "function");
  assert.equal(typeof taskStore.listTasks, "function");
});
