import assert from "node:assert/strict";
import test from "node:test";
import { listCloudFiles, uploadCloudFile, downloadCloudFile } from "./storage";

test("storage tools exports are valid functions", () => {
  assert.equal(typeof listCloudFiles, "function");
  assert.equal(typeof uploadCloudFile, "function");
  assert.equal(typeof downloadCloudFile, "function");
});
