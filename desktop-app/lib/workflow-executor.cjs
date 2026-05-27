const { clipboard, desktopCapturer, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");

let robot = null;
let robotLoadError = null;

try {
  robot = require("robotjs");
} catch (error) {
  robotLoadError = error;
}

const ACTIVE_STATES = new Set(["pending-approval", "running", "paused"]);
const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_SHELL_OUTPUT_BYTES = 64 * 1024;
const MOUSE_INTERRUPT_POLL_MS = 150;
const MOUSE_INTERRUPT_DISTANCE_PX = 18;
const MOUSE_AUTOMATION_IGNORE_MS = 900;
const ALLOWED_ACTION_TYPES = new Set([
  "screenshot",
  "wait",
  "launchApp",
  "openPath",
  "revealPath",
  "readFile",
  "writeFile",
  "shellCommand",
  "closeWindow",
  "click",
  "moveMouse",
  "dragMouse",
  "mouseDown",
  "mouseUp",
  "type",
  "keyPress",
  "setClipboard",
  "getClipboard",
  "scroll",
]);

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clonePlain(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

function asString(value, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isHttpUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function isExternalOpenTarget(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol.length > 2;
  } catch {
    return false;
  }
}

function appendLimitedOutput(current, chunk) {
  const next = `${current}${chunk}`;
  if (Buffer.byteLength(next, "utf8") <= MAX_SHELL_OUTPUT_BYTES) {
    return next;
  }

  return next.slice(-MAX_SHELL_OUTPUT_BYTES);
}

function formatErrorMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

function quotePowerShellString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function getWindowsStartAppSearchTerms(appPath) {
  const terms = [];
  const trimmed = asString(appPath);
  if (trimmed) {
    terms.push(trimmed);
  }

  const extension = path.extname(trimmed);
  const basename = extension ? path.basename(trimmed, extension) : path.basename(trimmed);
  if (basename && basename !== trimmed) {
    terms.push(basename);
  }

  return [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
}

function readChildProcessOutput(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    const child = spawn(command, args, options);

    child.stdout?.on("data", (data) => {
      stdout = appendLimitedOutput(stdout, data.toString());
    });

    child.stderr?.on("data", (data) => {
      stderr = appendLimitedOutput(stderr, data.toString());
    });

    child.once("error", reject);
    child.once("close", (code) => {
      const output = { code, stdout: stdout.trim(), stderr: stderr.trim() };
      if (code && code !== 0) {
        reject(new Error(output.stderr || output.stdout || `${command} exited with code ${code}.`));
        return;
      }

      resolve(output);
    });
  });
}

async function resolveWindowsStartApp(appPath) {
  if (process.platform !== "win32") {
    return null;
  }

  const terms = getWindowsStartAppSearchTerms(appPath);
  if (terms.length === 0) {
    return null;
  }

  const powerShellTerms = terms.map(quotePowerShellString).join(", ");
  const script = [
    `$targets = @(${powerShellTerms})`,
    "$apps = Get-StartApps | Where-Object { $_.Name -and $_.AppID }",
    "$match = $null",
    "foreach ($target in $targets) {",
    "  $match = $apps | Where-Object { $_.Name -ieq $target -or $_.AppID -ieq $target } | Select-Object -First 1",
    "  if ($match) { break }",
    "}",
    "if (-not $match) {",
    "  foreach ($target in $targets) {",
    "    $match = $apps | Where-Object { $_.Name.IndexOf($target, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | Sort-Object { $_.Name.Length } | Select-Object -First 1",
    "    if ($match) { break }",
    "  }",
    "}",
    "if ($match) { [PSCustomObject]@{ Name = $match.Name; AppID = $match.AppID } | ConvertTo-Json -Compress }",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true }
  );

  if (!result.stdout) {
    return null;
  }

  const parsed = JSON.parse(result.stdout);
  const app = Array.isArray(parsed) ? parsed[0] : parsed;
  const name = asString(app?.Name);
  const appId = asString(app?.AppID);
  return name && appId ? { name, appId } : null;
}

function killChildProcessTree(child) {
  if (!child?.pid) {
    return;
  }

  try {
    if (process.platform === "win32") {
      spawn("taskkill.exe", ["/pid", String(child.pid), "/T", "/F"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      return;
    }

    child.kill("SIGTERM");
  } catch {
    try {
      child.kill("SIGKILL");
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function normalizeAction(action) {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    throw new Error("Workflow step action must be an object.");
  }

  const type = asString(action.type);
  if (!ALLOWED_ACTION_TYPES.has(type)) {
    throw new Error(`Unsupported desktop action type: ${type || "unknown"}`);
  }

  return { ...action, type };
}

function normalizeWorkflow(input, userId) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("Workflow payload is required.");
  }

  const steps = Array.isArray(input.steps) ? input.steps : [];
  if (steps.length === 0) {
    throw new Error("Workflow must include at least one step.");
  }

  const normalizedSteps = steps.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      throw new Error(`Workflow step ${index + 1} must be an object.`);
    }

    const action = normalizeAction(step.action);
    return {
      id: asString(step.id, `step_${index + 1}`),
      name: asString(step.name, `Step ${index + 1}`),
      description: typeof step.description === "string" ? step.description : "",
      action,
      timeout:
        typeof step.timeout === "number" && Number.isFinite(step.timeout)
          ? Math.max(500, step.timeout)
          : 30000,
      retry:
        step.retry && typeof step.retry === "object"
          ? {
              max:
                typeof step.retry.max === "number" && Number.isFinite(step.retry.max)
                  ? Math.max(1, Math.floor(step.retry.max))
                  : 1,
              backoffMs:
                typeof step.retry.backoffMs === "number" && Number.isFinite(step.retry.backoffMs)
                  ? Math.max(0, step.retry.backoffMs)
                  : 1000,
            }
          : { max: 1, backoffMs: 1000 },
    };
  });

  const source = ["chat-tool", "template", "test"].includes(input.source)
    ? input.source
    : "chat-tool";

  return {
    id: asString(input.id || input.workflowId, makeId("workflow")),
    name: asString(input.name || input.task, "Desktop Workflow"),
    description: typeof input.description === "string" ? input.description : "",
    source,
    requiresApproval: input.requiresApproval !== false || source === "chat-tool",
    userId: asString(input.userId, userId),
    steps: normalizedSteps,
  };
}

function requireRobot(actionType) {
  if (robot) {
    return robot;
  }

  const detail = robotLoadError?.message ? `: ${robotLoadError.message}` : "";
  throw new Error(`robotjs is not available for ${actionType}${detail}`);
}

function mapModifier(value) {
  const normalized = String(value || "").toLowerCase();
  if (normalized === "ctrl" || normalized === "control") return "control";
  if (normalized === "cmd" || normalized === "command" || normalized === "meta") return "command";
  if (normalized === "shift") return "shift";
  if (normalized === "alt" || normalized === "option") return "alt";
  return normalized;
}

function mapKey(value) {
  const normalized = String(value || "").trim();
  const lower = normalized.toLowerCase();
  const keyMap = {
    enter: "enter",
    return: "enter",
    escape: "escape",
    esc: "escape",
    tab: "tab",
    space: "space",
    backspace: "backspace",
    delete: "delete",
    del: "delete",
    up: "up",
    down: "down",
    left: "left",
    right: "right",
    home: "home",
    end: "end",
    pageup: "pageup",
    pagedown: "pagedown",
  };

  if (keyMap[lower]) {
    return keyMap[lower];
  }

  if (/^f([1-9]|1[0-2])$/i.test(normalized)) {
    return lower;
  }

  return normalized.length === 1 ? lower : normalized;
}

function parseKeyPress(action) {
  let rawKey = asString(action.key);
  const modifiers = Array.isArray(action.modifiers)
    ? action.modifiers.map(mapModifier).filter(Boolean)
    : [];

  if (rawKey.includes("+")) {
    const parts = rawKey.split("+").map((part) => part.trim()).filter(Boolean);
    rawKey = parts.pop() || rawKey;
    modifiers.push(...parts.map(mapModifier).filter(Boolean));
  }

  return {
    key: mapKey(rawKey),
    modifiers: Array.from(new Set(modifiers)),
  };
}

function normalizeMouseButton(value) {
  const normalized = asString(value, "left").toLowerCase();
  if (normalized === "left" || normalized === "right" || normalized === "middle") {
    return normalized;
  }

  throw new Error(`Unsupported mouse button: ${normalized || "unknown"}`);
}

function readFiniteNumber(value, label) {
  if (value === null || value === undefined || value === "") {
    throw new Error(`${label} must be a numeric value.`);
  }

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${label} must be a numeric value.`);
  }

  return parsed;
}

function readOptionalFiniteNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function withTimeout(promise, timeoutMs, label) {
  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeout]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

class WorkflowExecutor {
  constructor({ mainWindow, userId }) {
    this.mainWindow = mainWindow;
    this.userId = userId || "default-user";
    this.currentWorkflow = null;
    this.workflowHistory = new Map();
    this.activeChildren = new Set();
    this.mouseInterruptTimer = null;
    this.mouseInterruptLastPosition = null;
    this.mouseAutomationIgnoreUntil = 0;
  }

  setMainWindow(mainWindow) {
    this.mainWindow = mainWindow;
  }

  readMousePosition() {
    if (!robot || typeof robot.getMousePos !== "function") {
      return null;
    }

    try {
      const position = robot.getMousePos();
      const x = Number(position?.x);
      const y = Number(position?.y);
      return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
    } catch {
      return null;
    }
  }

  noteAutomatedMouseActivity(ignoreMs = MOUSE_AUTOMATION_IGNORE_MS) {
    this.mouseAutomationIgnoreUntil = Math.max(this.mouseAutomationIgnoreUntil, Date.now() + ignoreMs);
    const position = this.readMousePosition();
    if (position) {
      this.mouseInterruptLastPosition = position;
    }
  }

  startMouseInterruptMonitor() {
    if (this.mouseInterruptTimer || !robot || typeof robot.getMousePos !== "function") {
      return;
    }

    this.mouseInterruptLastPosition = this.readMousePosition();
    this.mouseInterruptTimer = setInterval(() => {
      this.checkManualMouseInterrupt();
    }, MOUSE_INTERRUPT_POLL_MS);
    this.mouseInterruptTimer.unref?.();
  }

  stopMouseInterruptMonitor() {
    if (this.mouseInterruptTimer) {
      clearInterval(this.mouseInterruptTimer);
      this.mouseInterruptTimer = null;
    }
    this.mouseInterruptLastPosition = null;
    this.mouseAutomationIgnoreUntil = 0;
  }

  checkManualMouseInterrupt() {
    if (!this.currentWorkflow || !ACTIVE_STATES.has(this.currentWorkflow.state)) {
      this.stopMouseInterruptMonitor();
      return;
    }

    const position = this.readMousePosition();
    if (!position) {
      return;
    }

    const previous = this.mouseInterruptLastPosition;
    this.mouseInterruptLastPosition = position;

    if (!previous || this.currentWorkflow.state !== "running" || Date.now() < this.mouseAutomationIgnoreUntil) {
      return;
    }

    const deltaX = position.x - previous.x;
    const deltaY = position.y - previous.y;
    if (Math.hypot(deltaX, deltaY) >= MOUSE_INTERRUPT_DISTANCE_PX) {
      this.stop("Workflow stopped because the user moved the mouse.");
    }
  }

  getState() {
    return this.currentWorkflow ? this.buildState() : null;
  }

  getHistory(workflowId) {
    if (workflowId) {
      const found = this.workflowHistory.get(workflowId);
      return found ? [clonePlain(found)] : [];
    }

    return Array.from(this.workflowHistory.values()).map(clonePlain);
  }

  async startWorkflow(workflowInput) {
    if (this.currentWorkflow && ACTIVE_STATES.has(this.currentWorkflow.state)) {
      return {
        success: false,
        error: `Workflow "${this.currentWorkflow.name}" is already ${this.currentWorkflow.state}.`,
        state: this.buildState(),
      };
    }

    const workflow = normalizeWorkflow(workflowInput, this.userId);
    const state = workflow.requiresApproval ? "pending-approval" : "running";

    this.currentWorkflow = {
      ...workflow,
      sessionId: makeId("desktop"),
      state,
      currentStepIndex: -1,
      completedSteps: [],
      approvalPoints: workflow.requiresApproval
        ? [
            {
              stepId: "__workflow__",
              reason: "Approve this desktop workflow before Rearvy controls your OS.",
              requiresApproval: true,
            },
          ]
        : [],
      pendingApproval: workflow.requiresApproval
        ? {
            workflowId: workflow.id,
            requestedAt: nowIso(),
            reason: "Approve this desktop workflow before Rearvy controls your OS.",
          }
        : null,
      logs: [],
      errorCount: 0,
      startedAt: state === "running" ? nowIso() : null,
      completedAt: null,
      updatedAt: nowIso(),
      screenshotDataUrl: null,
      error: null,
      abortRequested: false,
    };

    await this.notifyStateChange();

    if (state === "running") {
      this.startMouseInterruptMonitor();
      this.runWorkflow().catch((error) => {
        this.failWorkflow(error);
      });
    }

    return { success: true, sessionId: this.currentWorkflow.sessionId, state: this.buildState() };
  }

  async approveWorkflow(workflowId) {
    if (!this.currentWorkflow || this.currentWorkflow.id !== workflowId) {
      return { success: false, error: "Workflow not found." };
    }

    if (this.currentWorkflow.state !== "pending-approval") {
      return { success: false, error: `Workflow is ${this.currentWorkflow.state}, not pending approval.` };
    }

    this.currentWorkflow.state = "running";
    this.currentWorkflow.pendingApproval = null;
    this.currentWorkflow.startedAt = nowIso();
    this.currentWorkflow.updatedAt = nowIso();
    this.pushLog({
      stepId: "__workflow__",
      stepName: "Approval",
      action: "approval",
      status: "success",
      durationMs: 0,
      result: "Workflow approved by user.",
    });

    await this.notifyStateChange();
    this.startMouseInterruptMonitor();
    this.runWorkflow().catch((error) => {
      this.failWorkflow(error);
    });

    return { success: true };
  }

  async rejectWorkflow(workflowId, reason) {
    if (!this.currentWorkflow || this.currentWorkflow.id !== workflowId) {
      return { success: false, error: "Workflow not found." };
    }

    if (!ACTIVE_STATES.has(this.currentWorkflow.state)) {
      return { success: false, error: `Workflow is already ${this.currentWorkflow.state}.` };
    }

    this.currentWorkflow.abortRequested = true;
    this.currentWorkflow.state = "rejected";
    this.currentWorkflow.error = asString(reason, "Workflow rejected by user.");
    this.currentWorkflow.completedAt = nowIso();
    this.currentWorkflow.updatedAt = nowIso();
    this.pushLog({
      stepId: "__workflow__",
      stepName: "Rejected",
      action: "reject",
      status: "failed",
      durationMs: 0,
      errorMessage: this.currentWorkflow.error,
    });
    this.archiveCurrentWorkflow();
    this.stopMouseInterruptMonitor();
    await this.notifyStateChange();
    return { success: true };
  }

  pause() {
    if (this.currentWorkflow && this.currentWorkflow.state === "running") {
      this.currentWorkflow.state = "paused";
      this.currentWorkflow.updatedAt = nowIso();
      void this.notifyStateChange();
      this.emitEvent("desktop:automation:paused");
    }
  }

  async resume() {
    if (this.currentWorkflow && this.currentWorkflow.state === "paused") {
      this.currentWorkflow.state = "running";
      this.currentWorkflow.updatedAt = nowIso();
      this.startMouseInterruptMonitor();
      await this.notifyStateChange();
      this.emitEvent("desktop:automation:resumed");
    }
  }

  stop() {
    if (this.currentWorkflow && ACTIVE_STATES.has(this.currentWorkflow.state)) {
      this.currentWorkflow.abortRequested = true;
      this.killActiveChildren();
      this.currentWorkflow.state = "stopped";
      this.currentWorkflow.completedAt = nowIso();
      this.currentWorkflow.updatedAt = nowIso();
      this.pushLog({
        stepId: "__workflow__",
        stepName: "Stopped",
        action: "stop",
        status: "failed",
        durationMs: 0,
        errorMessage: "Workflow stopped by user.",
      });
      this.archiveCurrentWorkflow();
      this.stopMouseInterruptMonitor();
      void this.notifyStateChange();
      this.emitEvent("desktop:automation:stopped");
    }
  }

  cleanup() {
    if (this.currentWorkflow && ACTIVE_STATES.has(this.currentWorkflow.state)) {
      this.currentWorkflow.abortRequested = true;
      this.killActiveChildren();
      this.currentWorkflow.state = "stopped";
      this.currentWorkflow.completedAt = nowIso();
      this.archiveCurrentWorkflow();
      this.stopMouseInterruptMonitor();
    }
  }

  killActiveChildren() {
    for (const child of this.activeChildren) {
      killChildProcessTree(child);
    }
    this.activeChildren.clear();
  }

  buildState() {
    const workflow = this.currentWorkflow;
    if (!workflow) {
      return null;
    }

    const currentStep = workflow.steps[workflow.currentStepIndex] || null;
    const nextStep = workflow.steps[workflow.currentStepIndex + 1] || null;

    return {
      sessionId: workflow.sessionId,
      workflowId: workflow.id,
      userId: workflow.userId,
      task: workflow.name,
      description: workflow.description,
      source: workflow.source,
      currentStep: currentStep ? currentStep.id : null,
      currentStepName: currentStep ? currentStep.name : null,
      currentStepIndex: workflow.currentStepIndex,
      nextStep: nextStep ? nextStep.id : null,
      nextStepName: nextStep ? nextStep.name : null,
      totalSteps: workflow.steps.length,
      completedSteps: [...workflow.completedSteps],
      approvalPoints: [...workflow.approvalPoints],
      requiresApproval: workflow.requiresApproval,
      approval: workflow.pendingApproval,
      state: workflow.state,
      logs: [...workflow.logs],
      errorCount: workflow.errorCount,
      startedAt: workflow.startedAt,
      completedAt: workflow.completedAt,
      updatedAt: workflow.updatedAt,
      screenshotDataUrl: workflow.screenshotDataUrl,
      error: workflow.error,
      steps: workflow.steps.map((step) => ({
        id: step.id,
        name: step.name,
        description: step.description,
        action: step.action,
        timeout: step.timeout,
        retry: step.retry,
      })),
    };
  }

  async notifyStateChange() {
    const state = this.buildState();
    if (!state || !this.mainWindow || this.mainWindow.isDestroyed?.()) {
      return;
    }

    this.mainWindow.webContents.send("desktop:automation:state-change", state);
  }

  emitEvent(channel, payload = null) {
    if (!this.mainWindow || this.mainWindow.isDestroyed?.()) {
      return;
    }

    this.mainWindow.webContents.send(channel, payload);
  }

  pushLog(input) {
    if (!this.currentWorkflow) {
      return null;
    }

    const log = {
      id: makeId("log"),
      stepId: input.stepId,
      stepName: input.stepName,
      action: input.action,
      status: input.status,
      durationMs: input.durationMs,
      startedAt: input.startedAt || nowIso(),
      completedAt: input.completedAt || nowIso(),
      errorMessage: input.errorMessage,
      result: input.result,
    };

    this.currentWorkflow.logs = [...this.currentWorkflow.logs, log].slice(-200);
    this.currentWorkflow.updatedAt = nowIso();
    return log;
  }

  archiveCurrentWorkflow() {
    if (!this.currentWorkflow) {
      return;
    }

    this.workflowHistory.set(this.currentWorkflow.id, this.buildState());
    if (this.workflowHistory.size > 24) {
      const oldestKey = this.workflowHistory.keys().next().value;
      this.workflowHistory.delete(oldestKey);
    }
  }

  async runWorkflow() {
    const workflow = this.currentWorkflow;
    if (!workflow) {
      return;
    }

    for (let index = 0; index < workflow.steps.length; index += 1) {
      await this.ensureRunnable();

      const step = workflow.steps[index];
      workflow.currentStepIndex = index;
      workflow.updatedAt = nowIso();
      await this.notifyStateChange();

      try {
        const result = await this.runStepWithRetry(step);
        workflow.completedSteps.push(step.id);
        this.pushLog({
          stepId: step.id,
          stepName: step.name,
          action: step.action.type,
          status: "success",
          durationMs: result.durationMs,
          startedAt: result.startedAt,
          completedAt: result.completedAt,
          result: result.output,
        });
        await this.notifyStateChange();
      } catch (error) {
        workflow.errorCount += 1;
        workflow.error = error instanceof Error ? error.message : String(error);
        workflow.state = workflow.abortRequested ? "stopped" : "failed";
        workflow.completedAt = nowIso();
        workflow.updatedAt = nowIso();
        this.pushLog({
          stepId: step.id,
          stepName: step.name,
          action: step.action.type,
          status: "failed",
          durationMs: 0,
          errorMessage: workflow.error,
        });
        this.archiveCurrentWorkflow();
        this.stopMouseInterruptMonitor();
        await this.notifyStateChange();
        return;
      }
    }

    workflow.state = "completed";
    workflow.currentStepIndex = workflow.steps.length;
    workflow.completedAt = nowIso();
    workflow.updatedAt = nowIso();
    this.archiveCurrentWorkflow();
    this.stopMouseInterruptMonitor();
    await this.notifyStateChange();
  }

  async runStepWithRetry(step) {
    const attempts = Math.max(1, step.retry?.max || 1);
    let lastError = null;

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      await this.ensureRunnable();

      const startedAt = nowIso();
      const started = Date.now();

      try {
        const output = await withTimeout(
          this.executeAction(step.action),
          step.timeout,
          step.name
        );

        const completedAt = nowIso();
        return {
          output,
          durationMs: Date.now() - started,
          startedAt,
          completedAt,
        };
      } catch (error) {
        lastError = error;
        if (attempt < attempts) {
          await sleep(step.retry?.backoffMs || 1000);
        }
      }
    }

    throw lastError || new Error(`Step failed: ${step.name}`);
  }

  async ensureRunnable() {
    while (this.currentWorkflow && this.currentWorkflow.state === "paused") {
      await sleep(150);
    }

    if (!this.currentWorkflow || this.currentWorkflow.abortRequested || this.currentWorkflow.state === "stopped") {
      throw new Error("Workflow stopped.");
    }

    if (this.currentWorkflow.state !== "running") {
      throw new Error(`Workflow is ${this.currentWorkflow.state}.`);
    }
  }

  async executeAction(action) {
    switch (action.type) {
      case "screenshot": {
        await this.captureScreenshot();
        return "Screenshot captured.";
      }

      case "wait": {
        const ms = typeof action.ms === "number" && Number.isFinite(action.ms) ? Math.max(0, action.ms) : 1000;
        const endAt = Date.now() + ms;
        while (Date.now() < endAt) {
          await this.ensureRunnable();
          await sleep(Math.min(150, endAt - Date.now()));
        }
        return `Waited ${ms}ms.`;
      }

      case "launchApp":
        return await this.launchApp(action);

      case "openPath":
        return await this.openPath(action);

      case "revealPath":
        return await this.revealPath(action);

      case "readFile":
        return await this.readFile(action);

      case "writeFile":
        return await this.writeFile(action);

      case "shellCommand":
        return await this.runShellCommand(action);

      case "closeWindow":
        return await this.closeWindow(action);

      case "click": {
        const nativeRobot = requireRobot("click");
        const x = readFiniteNumber(action.x, "click.x");
        const y = readFiniteNumber(action.y, "click.y");
        const button = normalizeMouseButton(action.button);
        this.noteAutomatedMouseActivity();
        nativeRobot.moveMouse(Math.round(x), Math.round(y));
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick(button, Boolean(action.double));
        this.noteAutomatedMouseActivity();
        return `Clicked ${Math.round(x)}, ${Math.round(y)}.`;
      }

      case "moveMouse": {
        const nativeRobot = requireRobot("moveMouse");
        const x = readFiniteNumber(action.x, "moveMouse.x");
        const y = readFiniteNumber(action.y, "moveMouse.y");
        this.noteAutomatedMouseActivity();
        nativeRobot.moveMouse(Math.round(x), Math.round(y));
        this.noteAutomatedMouseActivity();
        return `Moved mouse to ${Math.round(x)}, ${Math.round(y)}.`;
      }

      case "dragMouse": {
        const nativeRobot = requireRobot("dragMouse");
        const toX = readFiniteNumber(action.toX ?? action.x, "dragMouse.toX");
        const toY = readFiniteNumber(action.toY ?? action.y, "dragMouse.toY");
        const fromX = readOptionalFiniteNumber(action.fromX);
        const fromY = readOptionalFiniteNumber(action.fromY);
        const button = normalizeMouseButton(action.button);
        const rawDurationMs = Number(action.durationMs ?? 350);
        const rawSteps = Number(action.steps ?? 24);
        const durationMs = Number.isFinite(rawDurationMs)
          ? Math.max(0, Math.min(5000, Math.round(rawDurationMs)))
          : 350;
        const steps = Number.isFinite(rawSteps)
          ? Math.max(1, Math.min(120, Math.round(rawSteps)))
          : 24;

        if (fromX !== null && fromY !== null) {
          this.noteAutomatedMouseActivity();
          nativeRobot.moveMouse(Math.round(fromX), Math.round(fromY));
          this.noteAutomatedMouseActivity();
        }

        if (durationMs === 0 || typeof nativeRobot.mouseToggle !== "function") {
          this.noteAutomatedMouseActivity();
          nativeRobot.dragMouse(Math.round(toX), Math.round(toY));
          this.noteAutomatedMouseActivity();
          return `Dragged mouse to ${Math.round(toX)}, ${Math.round(toY)}.`;
        }

        const start = nativeRobot.getMousePos?.() || { x: fromX ?? toX, y: fromY ?? toY };
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseToggle("down", button);
        try {
          for (let index = 1; index <= steps; index += 1) {
            await this.ensureRunnable();
            const progress = index / steps;
            const nextX = start.x + (toX - start.x) * progress;
            const nextY = start.y + (toY - start.y) * progress;
            nativeRobot.moveMouse(Math.round(nextX), Math.round(nextY));
            this.noteAutomatedMouseActivity();
            if (index < steps) {
              await sleep(Math.max(1, Math.round(durationMs / steps)));
            }
          }
        } finally {
          nativeRobot.mouseToggle("up", button);
          this.noteAutomatedMouseActivity();
        }

        return `Dragged mouse to ${Math.round(toX)}, ${Math.round(toY)}.`;
      }

      case "mouseDown": {
        const nativeRobot = requireRobot("mouseDown");
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseToggle("down", normalizeMouseButton(action.button));
        this.noteAutomatedMouseActivity();
        return "Mouse button held down.";
      }

      case "mouseUp": {
        const nativeRobot = requireRobot("mouseUp");
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseToggle("up", normalizeMouseButton(action.button));
        this.noteAutomatedMouseActivity();
        return "Mouse button released.";
      }

      case "type": {
        const nativeRobot = requireRobot("type");
        const text = String(action.text ?? "");
        const delayMs = Number(action.delayMs ?? action.delay);
        if (Number.isFinite(delayMs) && delayMs > 0) {
          const perCharacterDelayMs = Math.max(1, Math.min(1000, Math.round(delayMs)));
          for (const character of text) {
            await this.ensureRunnable();
            nativeRobot.typeString(character);
            await sleep(perCharacterDelayMs);
          }
        } else {
          nativeRobot.typeString(text);
        }
        return "Typed text.";
      }

      case "keyPress": {
        const nativeRobot = requireRobot("keyPress");
        const { key, modifiers } = parseKeyPress(action);
        if (!key) {
          throw new Error("keyPress requires a key.");
        }
        nativeRobot.keyTap(key, modifiers);
        return modifiers.length ? `Pressed ${modifiers.join("+")}+${key}.` : `Pressed ${key}.`;
      }

      case "setClipboard":
        clipboard.writeText(String(action.text ?? ""));
        return "Clipboard updated.";

      case "getClipboard":
        return clipboard.readText();

      case "scroll": {
        const nativeRobot = requireRobot("scroll");
        const amount = Number(action.amount);
        const normalizedAmount = Number.isFinite(amount) ? Math.max(1, Math.round(amount)) : 5;
        const direction = asString(action.direction, "down");
        let x = 0;
        let y = 0;
        if (direction === "up") y = normalizedAmount;
        if (direction === "down") y = -normalizedAmount;
        if (direction === "left") x = -normalizedAmount;
        if (direction === "right") x = normalizedAmount;
        nativeRobot.scrollMouse(x, y);
        return `Scrolled ${direction}.`;
      }

      default:
        throw new Error(`Unsupported action: ${action.type}`);
    }
  }

  async captureScreenshot() {
    const sources = await desktopCapturer.getSources({
      types: ["screen"],
      thumbnailSize: { width: 1280, height: 720 },
      fetchWindowIcons: false,
    });

    const source = sources[0];
    const dataUrl = source ? source.thumbnail.toDataURL() : null;
    if (this.currentWorkflow) {
      this.currentWorkflow.screenshotDataUrl = dataUrl;
      this.currentWorkflow.updatedAt = nowIso();
    }

    return dataUrl;
  }

  async launchApp(action) {
    const appPath = asString(action.appPath || action.path || action.url);
    const args = Array.isArray(action.args) ? action.args.map(String) : [];
    const launchErrors = [];
    const urlTarget = [appPath, ...args].find(isHttpUrl);
    const looksLikeBrowser =
      !appPath ||
      isHttpUrl(appPath) ||
      /\b(chrome|msedge|edge|firefox|browser)\b/i.test(appPath);

    if (urlTarget && looksLikeBrowser) {
      await shell.openExternal(urlTarget);
      if (action.wait !== false) {
        await sleep(1000);
      }
      return `Opened ${urlTarget}.`;
    }

    if (!appPath) {
      throw new Error("launchApp requires appPath or url.");
    }

    try {
      await new Promise((resolve, reject) => {
        const child = spawn(appPath, args, {
          detached: true,
          stdio: "ignore",
          windowsHide: process.platform === "win32",
        });

        child.once("error", reject);
        child.once("spawn", () => {
          try {
            child.unref();
          } catch {
            // Ignore unref failures.
          }
          resolve();
        });
      });

      if (action.wait !== false) {
        await sleep(1000);
      }

      return `Launched ${appPath}.`;
    } catch (error) {
      launchErrors.push(`direct spawn failed: ${formatErrorMessage(error)}`);
    }

    if (process.platform === "win32") {
      try {
        const startApp = await resolveWindowsStartApp(appPath);
        if (!startApp) {
          launchErrors.push("Start Menu lookup found no matching app.");
        } else {
          await shell.openExternal(`shell:AppsFolder\\${startApp.appId}`);
          if (action.wait !== false) {
            await sleep(1000);
          }
          return `Launched ${startApp.name}.`;
        }
      } catch (error) {
        launchErrors.push(`Start Menu fallback failed: ${formatErrorMessage(error)}`);
      }
    }

    throw new Error(`Could not launch ${appPath}. ${launchErrors.join(" ")}`);
  }

  async openPath(action) {
    const target = asString(action.target || action.path || action.url || action.appPath);
    if (!target) {
      throw new Error("openPath requires target, path, or url.");
    }

    if (isExternalOpenTarget(target)) {
      await shell.openExternal(target);
      if (action.wait !== false) {
        await sleep(500);
      }
      return `Opened ${target}.`;
    }

    const resolvedPath = path.resolve(target);
    const errorMessage = await shell.openPath(resolvedPath);
    if (errorMessage) {
      throw new Error(errorMessage);
    }

    if (action.wait !== false) {
      await sleep(500);
    }
    return `Opened ${resolvedPath}.`;
  }

  async revealPath(action) {
    const target = asString(action.target || action.path || action.filePath);
    if (!target) {
      throw new Error("revealPath requires target or path.");
    }

    const resolvedPath = path.resolve(target);
    shell.showItemInFolder(resolvedPath);
    await sleep(300);
    return `Revealed ${resolvedPath}.`;
  }

  async readFile(action) {
    const filePath = asString(action.filePath || action.path || action.target);
    if (!filePath) {
      throw new Error("readFile requires filePath.");
    }

    const resolvedPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${resolvedPath}`);
    }
    if (stats.size > MAX_TEXT_FILE_SIZE_BYTES) {
      throw new Error(`File is too large to read as text: ${resolvedPath}`);
    }

    return await fs.readFile(resolvedPath, "utf8");
  }

  async writeFile(action) {
    const filePath = asString(action.filePath || action.path || action.target);
    if (!filePath) {
      throw new Error("writeFile requires filePath.");
    }

    const resolvedPath = path.resolve(filePath);
    await fs.writeFile(resolvedPath, String(action.content ?? ""), "utf8");
    return `Wrote ${resolvedPath}.`;
  }

  async runShellCommand(action) {
    const command = asString(action.command);
    if (!command) {
      throw new Error("shellCommand requires command.");
    }

    const cwd = asString(action.cwd, process.cwd());
    const spawnCommand = process.platform === "win32" ? "powershell.exe" : command;
    const spawnArgs =
      process.platform === "win32"
        ? ["-NoProfile", "-NonInteractive", "-Command", command]
        : [];
    const spawnOptions = {
      cwd,
      env: { ...process.env, FORCE_COLOR: "0" },
      windowsHide: process.platform === "win32",
      shell: process.platform !== "win32",
    };

    return await new Promise((resolve, reject) => {
      let settled = false;
      let stdout = "";
      let stderr = "";
      let stopCheck = null;
      const child = spawn(spawnCommand, spawnArgs, spawnOptions);
      this.activeChildren.add(child);

      const finish = (callback, value) => {
        if (settled) {
          return;
        }
        settled = true;
        if (stopCheck) {
          clearInterval(stopCheck);
        }
        this.activeChildren.delete(child);
        callback(value);
      };

      stopCheck = setInterval(() => {
        if (this.currentWorkflow?.abortRequested) {
          killChildProcessTree(child);
          finish(reject, new Error("Shell command stopped."));
        }
      }, 150);

      child.stdout?.on("data", (data) => {
        stdout = appendLimitedOutput(stdout, data.toString());
      });

      child.stderr?.on("data", (data) => {
        stderr = appendLimitedOutput(stderr, data.toString());
      });

      child.once("error", (error) => {
        finish(reject, error);
      });

      child.once("close", (code) => {
        const output = {
          exitCode: typeof code === "number" ? code : null,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };

        if (code && code !== 0) {
          const message = output.stderr || output.stdout || `Shell command exited with code ${code}.`;
          const error = new Error(message);
          error.output = output;
          finish(reject, error);
          return;
        }

        finish(resolve, output);
      });
    });
  }

  async closeWindow(action) {
    const windowTitle = asString(action.windowTitle);
    if (windowTitle) {
      throw new Error("closeWindow by title requires native window targeting that is not available in this desktop executor.");
    }

    const nativeRobot = requireRobot("closeWindow");
    if (process.platform === "darwin" && !action.force) {
      nativeRobot.keyTap("w", ["command"]);
      await sleep(300);
      return "Sent Command+W to close the active window.";
    }

    nativeRobot.keyTap("f4", ["alt"]);
    await sleep(300);
    return "Sent Alt+F4 to close the active window.";
  }

  async failWorkflow(error) {
    if (!this.currentWorkflow) {
      return;
    }

    this.currentWorkflow.state = "failed";
    this.currentWorkflow.error = error instanceof Error ? error.message : String(error);
    this.currentWorkflow.errorCount += 1;
    this.currentWorkflow.completedAt = nowIso();
    this.currentWorkflow.updatedAt = nowIso();
    this.archiveCurrentWorkflow();
    this.stopMouseInterruptMonitor();
    await this.notifyStateChange();
  }
}

module.exports = {
  WorkflowExecutor,
  normalizeWorkflow,
  ALLOWED_ACTION_TYPES,
};
