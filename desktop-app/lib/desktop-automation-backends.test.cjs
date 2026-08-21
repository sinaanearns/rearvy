"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  buildTerminatorSelector,
  getBackendOrder,
  getBackendPreference,
  getDesiredToggleState,
  normalizeControlType,
} = require("./desktop-automation-backends.cjs");

test("Terminator selectors preserve semantic role targeting and neutralize selector operators", () => {
  assert.equal(
    buildTerminatorSelector({ text: "Save && Close", controlType: "button" }),
    "role:Button && name:Save   Close"
  );
  assert.equal(normalizeControlType("checkbox"), "CheckBox");
});

test("desktop backend preference is explicit and native remains the no-install fallback", () => {
  assert.equal(getBackendPreference({ REARVY_DESKTOP_AUTOMATION_BACKEND: "touchpoint" }), "touchpoint");
  assert.equal(getBackendPreference({ REARVY_DESKTOP_AUTOMATION_BACKEND: "uiautomation" }), "uiautomation");
  assert.equal(getBackendPreference({ REARVY_DESKTOP_AUTOMATION_BACKEND: "ocr" }), "ocr");
  assert.equal(getBackendPreference({ REARVY_DESKTOP_AUTOMATION_BACKEND: "unknown" }), "auto");
  assert.deepEqual(getBackendOrder("auto"), ["terminator", "touchpoint", "pywinauto", "uiautomation"]);
  assert.deepEqual(getBackendOrder("native"), []);
  assert.equal(getDesiredToggleState({ checked: false }), "unchecked");
});
