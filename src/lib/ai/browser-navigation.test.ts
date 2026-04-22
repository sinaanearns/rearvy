import assert from "node:assert/strict";
import test from "node:test";
import {
  describeQuickOpenTarget,
  inferQuickStartUrl,
  shouldForceBrowserTaskFirstStep,
} from "./browser-navigation.ts";

test("forces browser routing for short brand-style open commands", () => {
  assert.equal(shouldForceBrowserTaskFirstStep("open rearvy"), true);
  assert.equal(shouldForceBrowserTaskFirstStep("go to github"), true);
});

test("does not force browser routing for obvious local targets", () => {
  assert.equal(shouldForceBrowserTaskFirstStep("open settings"), false);
  assert.equal(shouldForceBrowserTaskFirstStep("open C:\\temp\\notes.txt"), false);
});

test("infers quick-open URLs for common destinations", () => {
  assert.equal(inferQuickStartUrl("open rearvy"), "https://www.rearvy.com");
  assert.equal(inferQuickStartUrl("open github"), "https://github.com");
  assert.equal(
    inferQuickStartUrl("visit docs", "google docs"),
    "https://docs.google.com/document"
  );
});

test("describes quick-open targets from known URLs", () => {
  assert.equal(
    describeQuickOpenTarget(null, "https://www.rearvy.com"),
    "Rearvy"
  );
  assert.equal(describeQuickOpenTarget(null, "https://github.com"), "GitHub");
});
