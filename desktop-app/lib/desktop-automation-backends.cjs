"use strict";

/**
 * Unified desktop-automation provider layer.
 *
 * Rearvy keeps OS-changing calls in WorkflowExecutor, behind a complete-plan
 * approval gate. This module only chooses the most reliable accessibility
 * implementation for a semantic workflow action; it never registers IPC or
 * grants a renderer direct input control.
 *
 * Provider order (auto): Terminator -> Touchpoint -> pywinauto -> native UIA.
 * The Python providers are optional and deliberately are not installed at
 * runtime. A packaged desktop app must remain functional without Python.
 */

const { spawn } = require("node:child_process");
const path = require("node:path");

const MAX_OUTPUT_BYTES = 1024 * 1024;
const CAPABILITY_CACHE_MS = 15_000;
const SUPPORTED_PREFERENCES = new Set(["auto", "terminator", "touchpoint", "pywinauto", "uiautomation", "ocr", "native"]);

let capabilityCache = null;

class DesktopBackendUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "DesktopBackendUnavailableError";
  }
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function getBackendPreference(env = process.env) {
  const preference = asString(env.REARVY_DESKTOP_AUTOMATION_BACKEND, "auto").toLowerCase();
  return SUPPORTED_PREFERENCES.has(preference) ? preference : "auto";
}

function getBackendOrder(preference = getBackendPreference()) {
  if (preference === "native") return [];
  if (preference === "auto") return ["terminator", "touchpoint", "pywinauto", "uiautomation"];
  return [preference];
}

function normalizeControlType(value) {
  const normalized = asString(value).replace(/\s+/g, "");
  const names = {
    checkbox: "CheckBox",
    check: "CheckBox",
    combobox: "ComboBox",
    combo: "ComboBox",
    dropdown: "ComboBox",
    edit: "Edit",
    input: "Edit",
    textbox: "Edit",
    textfield: "Edit",
    button: "Button",
    link: "Hyperlink",
    hyperlink: "Hyperlink",
    menu: "MenuItem",
    menuitem: "MenuItem",
    tab: "TabItem",
    tabitem: "TabItem",
    list: "List",
    listitem: "ListItem",
    radio: "RadioButton",
    radiobutton: "RadioButton",
    switch: "CheckBox",
    toggle: "CheckBox",
  };

  return names[normalized.toLowerCase()] || normalized;
}

function selectorValue(value) {
  // Terminator's selector grammar uses && / || as operators. Escaping keeps a
  // user-visible label from accidentally changing the selector expression.
  return asString(value).replace(/\\/g, "\\\\").replace(/&&|\|\|/g, " ").replace(/:/g, "\\:");
}

function buildTerminatorSelector(action = {}) {
  const text = asString(action.text || action.label || action.name || action.target);
  const role = normalizeControlType(action.controlType || action.role || action.kind);
  const parts = [];
  if (role) parts.push(`role:${selectorValue(role)}`);
  if (text) parts.push(`name:${selectorValue(text)}`);
  if (parts.length === 0) {
    throw new Error("An accessibility action requires a text label or control type.");
  }
  return parts.join(" && ");
}

function actionScope(action = {}) {
  return asString(action.process || action.app || action.appName || action.application);
}

function actionTimeout(action = {}) {
  const timeout = Number(action.timeoutMs || action.timeout || 8000);
  return Number.isFinite(timeout) ? Math.max(500, Math.min(15_000, Math.round(timeout))) : 8000;
}

function getDesiredToggleState(action = {}) {
  if (typeof action.checked === "boolean") return action.checked ? "checked" : "unchecked";
  const desired = asString(action.state ?? action.value ?? action.mode, "toggle").toLowerCase();
  if (["checked", "true", "on", "check"].includes(desired)) return "checked";
  if (["unchecked", "false", "off", "uncheck"].includes(desired)) return "unchecked";
  return "toggle";
}

function loadTerminator() {
  try {
    const terminatorModule = require("@mediar-ai/terminator");
    if (typeof terminatorModule?.Desktop !== "function") {
      throw new Error("The package does not export Desktop.");
    }
    return terminatorModule;
  } catch (error) {
    throw new DesktopBackendUnavailableError(
      `Terminator is unavailable: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function createTerminatorLocator(desktop, action) {
  const selector = buildTerminatorSelector(action);
  const scope = actionScope(action);
  return scope
    ? desktop.locatorForProcess(scope, selector, asString(action.windowTitle || action.window || action.title) || null)
    : desktop.locator(selector);
}

function safeElementField(element, name, fallback = null) {
  try {
    const value = element?.[name];
    return typeof value === "function" ? value.call(element) : fallback;
  } catch {
    return fallback;
  }
}

function serializeTerminatorElement(element) {
  const bounds = safeElementField(element, "bounds", {}) || {};
  return {
    id: safeElementField(element, "id"),
    name: safeElementField(element, "name", ""),
    controlType: safeElementField(element, "role", ""),
    x: Number(bounds.x) || 0,
    y: Number(bounds.y) || 0,
    width: Number(bounds.width) || 0,
    height: Number(bounds.height) || 0,
    centerX: Math.round((Number(bounds.x) || 0) + (Number(bounds.width) || 0) / 2),
    centerY: Math.round((Number(bounds.y) || 0) + (Number(bounds.height) || 0) / 2),
    isEnabled: safeElementField(element, "isEnabled"),
    isVisible: safeElementField(element, "isVisible"),
    isSelected: safeElementField(element, "isSelected"),
    value: safeElementField(element, "getValue"),
  };
}

async function executeWithTerminator(operation, action = {}) {
  if (process.platform !== "win32") {
    throw new DesktopBackendUnavailableError("Terminator is currently available only on Windows.");
  }

  const { Desktop } = loadTerminator();
  const desktop = new Desktop(false, false, "warn");
  const timeoutMs = actionTimeout(action);

  if (operation === "list") {
    const scope = actionScope(action);
    if (!scope) {
      throw new DesktopBackendUnavailableError("Terminator snapshots require an app/process scope.");
    }
    const result = await desktop.getWindowTreeResultAsync(
      scope,
      asString(action.windowTitle || action.window || action.title) || null,
      { formatOutput: true, treeOutputFormat: "CompactYaml", maxDepth: Math.min(Number(action.maxDepth) || 12, 20) }
    );
    return {
      elements: Object.entries(result.indexToBounds || {}).map(([id, entry]) => ({
        id: `terminator:${id}`,
        name: entry?.name || "",
        controlType: entry?.role || "",
        x: Number(entry?.bounds?.x) || 0,
        y: Number(entry?.bounds?.y) || 0,
        width: Number(entry?.bounds?.width) || 0,
        height: Number(entry?.bounds?.height) || 0,
        centerX: Math.round((Number(entry?.bounds?.x) || 0) + (Number(entry?.bounds?.width) || 0) / 2),
        centerY: Math.round((Number(entry?.bounds?.y) || 0) + (Number(entry?.bounds?.height) || 0) / 2),
      })),
      snapshot: result.formatted || "",
    };
  }

  const locator = createTerminatorLocator(desktop, action);
  const element = operation === "wait" ? await locator.waitFor("visible", timeoutMs) : await locator.first(timeoutMs);

  if (operation === "find") return serializeTerminatorElement(element);
  if (operation === "state") return serializeTerminatorElement(element);
  if (operation === "value") return serializeTerminatorElement(element);

  if (operation === "invoke") {
    element.invoke({ tryFocusBefore: true, tryClickBefore: false, includeWindowScreenshot: false });
    return serializeTerminatorElement(element);
  }

  if (operation === "click") {
    await element.click({ tryFocusBefore: true, tryClickBefore: false, includeWindowScreenshot: false });
    return serializeTerminatorElement(element);
  }

  if (operation === "setValue") {
    const value = String(action.value ?? action.textToSet ?? action.input ?? action.content ?? "");
    if (!value && value !== "") throw new Error("setElementValue requires a value.");
    element.setValue(value, { tryFocusBefore: true, tryClickBefore: false, includeWindowScreenshot: false });
    return { ...serializeTerminatorElement(element), value, valueLength: value.length };
  }

  if (operation === "type") {
    const value = String(action.value ?? action.textToType ?? action.input ?? action.content ?? "");
    if (!value) throw new Error("typeIntoElement requires a value.");
    element.typeText(value, {
      clearBeforeTyping: action.clear !== false,
      tryFocusBefore: true,
      tryClickBefore: false,
      includeWindowScreenshot: false,
    });
    return { ...serializeTerminatorElement(element), valueLength: value.length };
  }

  if (operation === "toggle") {
    const desired = getDesiredToggleState(action);
    if (desired !== "toggle" && typeof element.setSelected === "function") {
      const selected = ["checked", "true", "on", "check"].includes(desired);
      element.setSelected(selected, { tryFocusBefore: true, tryClickBefore: false });
    } else {
      element.invoke({ tryFocusBefore: true, tryClickBefore: false, includeWindowScreenshot: false });
    }
    return serializeTerminatorElement(element);
  }

  if (operation === "focus") {
    if (typeof element.focus === "function") {
      element.focus();
    } else {
      await element.click({ tryFocusBefore: true, tryClickBefore: false });
    }
    return serializeTerminatorElement(element);
  }

  if (operation === "select") {
    if (typeof element.setSelected === "function") {
      element.setSelected(true, { tryFocusBefore: true, tryClickBefore: false });
    } else {
      await element.click({ tryFocusBefore: true, tryClickBefore: false });
    }
    return serializeTerminatorElement(element);
  }

  if (operation === "expand" || operation === "collapse") {
    element.invoke({ tryFocusBefore: true, tryClickBefore: false });
    return serializeTerminatorElement(element);
  }

  if (operation === "shortcut") {
    const keys = String(action.keys ?? action.shortcut ?? action.value ?? "");
    if (!keys) throw new Error("shortcut requires key combinations.");
    element.typeText(keys, { clearBeforeTyping: false, tryFocusBefore: true });
    return serializeTerminatorElement(element);
  }

  if (operation === "scroll") {
    element.invoke({ tryFocusBefore: true, tryClickBefore: false });
    return serializeTerminatorElement(element);
  }

  throw new Error(`Unsupported Terminator operation: ${operation}`);
}

function pythonCommands() {
  const configured = asString(process.env.REARVY_PYTHON_BIN);
  const candidates = configured ? [{ command: configured, args: [] }] : [];
  if (process.platform === "win32") candidates.push({ command: "py.exe", args: ["-3"] });
  candidates.push({ command: "python.exe", args: [] }, { command: "python3", args: [] });
  return candidates;
}

function runPythonHost(payload, candidate) {
  const scriptPath = path.join(__dirname, "..", "automation-python", "desktop_workflow_host.py");
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(candidate.command, [...candidate.args, scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
    });
    const finish = (error, result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      error ? reject(error) : resolve(result);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new Error("Python accessibility host timed out."));
    }, 20_000);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
      if (Buffer.byteLength(stdout, "utf8") > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(new Error("Python accessibility host exceeded the output limit."));
      }
    });
    child.stderr.on("data", (chunk) => { stderr += String(chunk); });
    child.on("error", (error) => finish(error));
    child.on("close", (code) => {
      if (code !== 0) {
        finish(new Error(stderr.trim() || `Python accessibility host exited with code ${code}.`));
        return;
      }
      try {
        const result = JSON.parse(stdout);
        if (!result?.ok) {
          finish(new DesktopBackendUnavailableError(result?.error || "Python accessibility provider is unavailable."));
          return;
        }
        finish(null, result);
      } catch (error) {
        finish(new Error(`Could not parse Python accessibility output: ${stdout.slice(0, 500) || error.message}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function runPythonProvider(provider, operation, action = {}) {
  let lastError = null;
  for (const candidate of pythonCommands()) {
    try {
      const result = await runPythonHost({ provider, operation, action }, candidate);
      return result.data;
    } catch (error) {
      lastError = error;
    }
  }
  throw new DesktopBackendUnavailableError(
    `${provider} is unavailable: ${lastError instanceof Error ? lastError.message : "Python was not found."}`
  );
}

async function getDesktopAutomationCapabilities({ refresh = false } = {}) {
  if (!refresh && capabilityCache && Date.now() - capabilityCache.createdAt < CAPABILITY_CACHE_MS) {
    return capabilityCache.value;
  }

  const terminator = (() => {
    try {
      loadTerminator();
      return { available: process.platform === "win32" };
    } catch (error) {
      return { available: false, reason: error.message };
    }
  })();

  let python = { touchpoint: false, pywinauto: false, uiautomation: false, python: false };
  for (const candidate of pythonCommands()) {
    try {
      const result = await runPythonHost({ provider: "diagnostics", operation: "diagnostics", action: {} }, candidate);
      python = { ...python, ...(result.data || {}), python: true };
      break;
    } catch {
      // A missing optional Python host must never prevent the native fallback.
    }
  }

  const value = {
    preferred: getBackendPreference(),
    providers: {
      terminator,
      touchpoint: { available: python.touchpoint === true },
      pywinauto: { available: python.pywinauto === true },
      uiautomation: { available: python.uiautomation === true },
      windowsOcr: { available: process.platform === "win32" },
      nativeUia: { available: process.platform === "win32" },
    },
    fallback: process.platform === "win32" ? "native-uia" : "none",
  };
  capabilityCache = { createdAt: Date.now(), value };
  return value;
}

async function executeSemanticDesktopAction(operation, action = {}) {
  const preference = getBackendPreference();
  const errors = [];
  for (const provider of getBackendOrder(preference)) {
    try {
      const value = provider === "terminator"
        ? await executeWithTerminator(operation, action)
        : await runPythonProvider(provider, operation, action);
      return { provider, value };
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
      if (preference !== "auto") throw error;
    }
  }
  const detail = errors.join(" | ") || "No external accessibility provider is configured.";
  throw new DesktopBackendUnavailableError(detail);
}

function isDesktopBackendUnavailable(error) {
  return error instanceof DesktopBackendUnavailableError;
}

module.exports = {
  DesktopBackendUnavailableError,
  buildTerminatorSelector,
  executeSemanticDesktopAction,
  getBackendOrder,
  getBackendPreference,
  getDesktopAutomationCapabilities,
  getDesiredToggleState,
  isDesktopBackendUnavailable,
  normalizeControlType,
};
