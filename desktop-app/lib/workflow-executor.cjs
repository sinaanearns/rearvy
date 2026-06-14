const { clipboard, desktopCapturer, shell } = require("electron");
const { spawn } = require("child_process");
const fs = require("fs/promises");
const path = require("path");
const { createLogger } = require("./logger.cjs");
const { normalizeScreenshotInputDataUrl } = require("./screenshot-data-url.cjs");

const log = createLogger("WorkflowExecutor");

let robot = null;
let robotLoadError = null;

try {
  robot = require("robotjs");
} catch (error) {
  robotLoadError = error;
}

const ACTIVE_STATES = new Set(["pending-approval", "running", "paused"]);
const MAX_TEXT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_DIRECTORY_ENTRIES = 200;
const MAX_DIRECTORY_OUTPUT_CHARS = 20000;
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
  "readVisibleText",
  "getElementState",
  "getElementValue",
  "invokeElement",
  "listDirectory",
  "createDirectory",
  "copyPath",
  "movePath",
  "trashPath",
  "writeFile",
  "appendToFile",
  "replaceInFile",
  "shellCommand",
  "listWindows",
  "listUiElements",
  "focusWindow",
  "setWindowState",
  "closeWindow",
  "waitForElement",
  "click",
  "clickElement",
  "typeIntoElement",
  "setElementValue",
  "selectOption",
  "setToggleState",
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

const DANGEROUS_COMMAND_PATTERNS = [
  /\bshutdown\b/i,
  /\brestart-computer\b/i,
  /\breboot\b/i,
  /\blogoff\b/i,
  /\buninstall\b/i,
  /\bremove-(?:item|appxpackage|service|localuser)\b/i,
  /\brm\s+-[^\n]*(?:r|f)/i,
  /\bdel(?:ete)?\b/i,
  /\berase\b/i,
  /\brmdir\b/i,
  /\brd\s+(?:\/[sq]\s*)+/i,
  /\bstop-process\b/i,
  /\btaskkill\b/i,
  /\bkill\s+-9\b/i,
  /\bkillall\b/i,
  /\bpkill\b/i,
  /\bsc\s+delete\b/i,
  /\breg\s+(?:add|delete|import)\b/i,
  /\bset-executionpolicy\b/i,
  /\bchmod\b/i,
  /\bchown\b/i,
  /\bmkfs\b/i,
  /\bdiskpart\b/i,
  /\bbcdedit\b/i,
  /\bformat\s+[a-z]:/i,
];

const PROTECTED_PATH_PATTERN =
  /(?:^|["'\s])(?:c:\\windows\\|c:\\program files(?: \(x86\))?\\|c:\\programdata\\|\/etc\/|\/bin\/|\/sbin\/|\/usr\/bin\/|\/usr\/sbin\/)/i;

const COMMAND_WRITE_PATTERN =
  /\b(?:echo|write|set-content|add-content|out-file|copy|move|new-item|ni|tee)\b/i;

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

function ignoreExpectedWorkflowFallback(context, error) {
  log.debug(`Ignored workflow fallback while ${context}:`, error?.message || error);
}

function firstRawString(...values) {
  return values.find((value) => typeof value === "string");
}

function hasDangerousActionText(action, actionType = "") {
  if (!action || typeof action !== "object" || Array.isArray(action)) {
    return false;
  }

  const command = typeof action.command === "string" ? action.command : "";
  if (actionType === "shellCommand" && DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    return true;
  }

  const copyDestinationPath = [action.destinationPath, action.toPath, action.target]
    .find((item) => typeof item === "string") || "";
  if (actionType === "copyPath" && PROTECTED_PATH_PATTERN.test(copyDestinationPath)) {
    return true;
  }
  const moveSourcePath = [action.sourcePath, action.fromPath, action.path, action.filePath, action.directoryPath]
    .find((item) => typeof item === "string") || "";
  if (
    actionType === "movePath" &&
    (PROTECTED_PATH_PATTERN.test(moveSourcePath) || PROTECTED_PATH_PATTERN.test(copyDestinationPath))
  ) {
    return true;
  }

  const targetPath = [action.path, action.filePath, action.directoryPath, action.target]
    .find((item) => typeof item === "string") || "";
  const trashTargetPath = [action.path, action.filePath, action.directoryPath, action.target, action.sourcePath, action.fromPath]
    .find((item) => typeof item === "string") || "";
  if (
    (actionType === "writeFile" ||
      actionType === "appendToFile" ||
      actionType === "replaceInFile" ||
      actionType === "createDirectory") &&
    PROTECTED_PATH_PATTERN.test(targetPath)
  ) {
    return true;
  }
  if (actionType === "trashPath" && PROTECTED_PATH_PATTERN.test(trashTargetPath)) {
    return true;
  }
  if (
    actionType === "shellCommand" &&
    PROTECTED_PATH_PATTERN.test(command) &&
    COMMAND_WRITE_PATTERN.test(command)
  ) {
    return true;
  }

  return false;
}

function isHttpUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch (error) {
    ignoreExpectedWorkflowFallback("checking HTTP URL", error);
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
  } catch (error) {
    ignoreExpectedWorkflowFallback("checking external open target", error);
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

  for (const term of [...terms]) {
    const withoutAppSuffix = term
      .replace(/\s+(?:desktop\s+)?(?:app|application|program|window)$/i, "")
      .trim();
    if (withoutAppSuffix && withoutAppSuffix !== term) {
      terms.push(withoutAppSuffix);
    }

    const withoutDesktopQualifier = term
      .replace(/\s+(?:from|on|in)\s+(?:the\s+|my\s+)?(?:desktop|windows|pc|computer)$/i, "")
      .replace(/\s+(?:desktop|windows|pc|computer)$/i, "")
      .trim();
    if (withoutDesktopQualifier && withoutDesktopQualifier !== term) {
      terms.push(withoutDesktopQualifier);
    }
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

async function resolveWindowsStartApps(appPath) {
  if (process.platform !== "win32") {
    return [];
  }

  const terms = getWindowsStartAppSearchTerms(appPath);
  if (terms.length === 0) {
    return [];
  }

  const powerShellTerms = terms.map(quotePowerShellString).join(", ");
  const script = [
    `$targets = @(${powerShellTerms})`,
    "$apps = Get-StartApps | Where-Object { $_.Name -and $_.AppID }",
    "$matches = New-Object System.Collections.Generic.List[object]",
    "foreach ($target in $targets) {",
    "  $apps | Where-Object { $_.Name -ieq $target -or $_.AppID -ieq $target } | ForEach-Object { $matches.Add($_) }",
    "}",
    "foreach ($target in $targets) {",
    "  $apps | Where-Object { $_.Name.IndexOf($target, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | Sort-Object { $_.Name.Length } | ForEach-Object { $matches.Add($_) }",
    "}",
    "$matches | Where-Object { $_.Name -and $_.AppID } | Select-Object Name, AppID -Unique -First 8 | ConvertTo-Json -Compress",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true }
  );

  if (!result.stdout) {
    return [];
  }

  const parsed = JSON.parse(result.stdout);
  const apps = Array.isArray(parsed) ? parsed : [parsed];
  return apps
    .map((app) => ({
      name: asString(app?.Name),
      appId: asString(app?.AppID),
    }))
    .filter((app) => app.name && app.appId);
}

async function launchWindowsStartApp(startApp) {
  const appId = asString(startApp?.appId);
  if (!appId) {
    throw new Error("Start app is missing an AppID.");
  }

  await new Promise((resolve, reject) => {
    const child = spawn("explorer.exe", [`shell:AppsFolder\\${appId}`], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      try {
        child.unref();
      } catch (error) {
        ignoreExpectedWorkflowFallback("detaching Windows Start app launcher", error);
      }
      resolve();
    });
  });

  return true;
}

function normalizeWindowsAppSearchText(value) {
  return asString(value)
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "");
}

function getWindowsShortcutSearchRoots() {
  const roots = [
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop") : "",
    "C:\\Users\\Public\\Desktop",
    process.env.APPDATA
      ? path.join(process.env.APPDATA, "Microsoft\\Windows\\Start Menu\\Programs")
      : "",
    process.env.PROGRAMDATA
      ? path.join(process.env.PROGRAMDATA, "Microsoft\\Windows\\Start Menu\\Programs")
      : "",
  ];

  return [...new Set(roots.map((root) => asString(root)).filter(Boolean))];
}

async function collectWindowsShortcutCandidates(root, terms, options = {}) {
  const maxDepth = typeof options.maxDepth === "number" ? options.maxDepth : 4;
  const deadline = typeof options.deadline === "number" ? options.deadline : Date.now() + 2500;
  const matches = [];

  async function walk(directory, depth) {
    if (Date.now() > deadline || depth > maxDepth) {
      return;
    }

    let entries = [];
    try {
      entries = await fs.readdir(directory, { withFileTypes: true });
    } catch (error) {
      ignoreExpectedWorkflowFallback("reading Windows shortcut directory", error);
      return;
    }

    for (const entry of entries) {
      if (Date.now() > deadline) {
        return;
      }

      const entryPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await walk(entryPath, depth + 1);
        continue;
      }

      if (!entry.isFile() || !/\.(?:lnk|url|appref-ms)$/i.test(entry.name)) {
        continue;
      }

      const normalizedName = normalizeWindowsAppSearchText(path.basename(entry.name, path.extname(entry.name)));
      if (!normalizedName) {
        continue;
      }

      const score = terms.includes(normalizedName)
        ? 0
        : terms.some((term) => normalizedName.includes(term) || term.includes(normalizedName))
          ? Math.abs(normalizedName.length - terms[0].length) + 1
          : null;

      if (score !== null) {
        matches.push({ path: entryPath, name: entry.name, score });
      }
    }
  }

  await walk(root, 0);
  return matches;
}

async function resolveWindowsShortcutApp(appPath) {
  if (process.platform !== "win32") {
    return null;
  }

  const terms = getWindowsStartAppSearchTerms(appPath)
    .map(normalizeWindowsAppSearchText)
    .filter(Boolean);
  if (terms.length === 0) {
    return null;
  }

  const roots = getWindowsShortcutSearchRoots();
  const deadline = Date.now() + 3500;
  const allMatches = [];

  for (const root of roots) {
    const matches = await collectWindowsShortcutCandidates(root, terms, {
      deadline,
      maxDepth: 5,
    });
    allMatches.push(...matches);
  }

  allMatches.sort((left, right) => {
    if (left.score !== right.score) {
      return left.score - right.score;
    }

    return left.name.length - right.name.length;
  });

  return allMatches[0] || null;
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
  } catch (error) {
    ignoreExpectedWorkflowFallback("terminating child process tree", error);
    try {
      child.kill("SIGKILL");
    } catch (killError) {
      ignoreExpectedWorkflowFallback("force-killing child process", killError);
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

  if (hasDangerousActionText(action, type)) {
    throw new Error("This workflow contains a potentially destructive action and was blocked.");
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
    requiresApproval: input.requiresApproval === true,
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

function normalizeUiControlType(value) {
  const normalized = asString(value).toLowerCase().replace(/\s+/g, "");
  const controlTypeMap = {
    button: "Button",
    edit: "Edit",
    input: "Edit",
    textbox: "Edit",
    text: "Text",
    link: "Hyperlink",
    hyperlink: "Hyperlink",
    tab: "TabItem",
    tabitem: "TabItem",
    menu: "MenuItem",
    menuitem: "MenuItem",
    dropdown: "ComboBox",
    combobox: "ComboBox",
    combo: "ComboBox",
    switch: "CheckBox",
    toggle: "CheckBox",
    list: "List",
    listitem: "ListItem",
    checkbox: "CheckBox",
    check: "CheckBox",
    option: "RadioButton",
    radio: "RadioButton",
    icon: "Image",
  };

  return controlTypeMap[normalized] || "";
}

function findWindowsUiElement(action) {
  if (process.platform !== "win32") {
    throw new Error("clickElement is currently supported on Windows desktop sessions only.");
  }

  const text = asString(action.text || action.label || action.name || action.target);
  if (!text) {
    throw new Error("clickElement requires text, label, name, or target.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind);
  const matchMode = asString(action.matchMode, "contains").toLowerCase() === "exact" ? "exact" : "contains";
  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 8000) || 8000));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$query = $env:CLICKY_UI_TEXT",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$matchMode = $env:CLICKY_UI_MATCH_MODE",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_UI_TIMEOUT_MS)",
    "function Find-Match {",
    "  $root = [System.Windows.Automation.AutomationElement]::RootElement",
    "  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach ($element in $all) {",
    "    $name = $element.Current.Name",
    "    if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "    $isNameMatch = if ($matchMode -eq 'exact') { [string]::Equals($name, $query, [System.StringComparison]::OrdinalIgnoreCase) } else { $name.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }",
    "    if (-not $isNameMatch) { continue }",
    "    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "    if ($controlType -and $typeName -ne $controlType) { continue }",
    "    $rect = $element.Current.BoundingRectangle",
    "    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "    return [pscustomobject]@{ name = $name; controlType = $typeName; x = [math]::Round($rect.X + ($rect.Width / 2)); y = [math]::Round($rect.Y + ($rect.Height / 2)); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height) }",
    "  }",
    "  return $null",
    "}",
    "do {",
    "  $match = Find-Match",
    "  if ($match) { $match | ConvertTo-Json -Compress; exit 0 }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No visible UI element matched '$query'.\"",
  ].join("; ");

  return new Promise((resolve, reject) => {
    let stdout = "";
    let stderr = "";
    let settled = false;
    const child = spawn(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-Command", script],
      {
        windowsHide: true,
        env: {
          ...process.env,
          CLICKY_UI_TEXT: text,
          CLICKY_UI_CONTROL_TYPE: controlType,
          CLICKY_UI_MATCH_MODE: matchMode,
          CLICKY_UI_TIMEOUT_MS: String(timeoutMs),
        },
      }
    );
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();
      reject(new Error(`Timed out finding UI element "${text}".`));
    }, timeoutMs + 1500);

    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      reject(error);
    });
    child.on("close", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(stderr.trim() || stdout.trim() || `UI Automation lookup exited with code ${code}.`));
        return;
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve(parsed);
      } catch (error) {
        reject(new Error(`Could not parse UI Automation result: ${stdout.trim() || error.message}`));
      }
    });
  });
}

async function listWindowsUiElements(action = {}) {
  if (process.platform !== "win32") {
    throw new Error("listUiElements is currently supported on Windows desktop sessions only.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind);
  const maxElements = Math.max(1, Math.min(200, Number(action.maxElements || action.maxItems || action.maxEntries || 80) || 80));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$max = [int]$env:CLICKY_UI_MAX_ELEMENTS",
    "$root = [System.Windows.Automation.AutomationElement]::RootElement",
    "$all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "$items = New-Object System.Collections.Generic.List[object]",
    "foreach ($element in $all) {",
    "  if ($items.Count -ge $max) { break }",
    "  $name = $element.Current.Name",
    "  if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "  $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "  if ($controlType -and $typeName -ne $controlType) { continue }",
    "  $rect = $element.Current.BoundingRectangle",
    "  if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "  $items.Add([pscustomobject]@{ name = $name; controlType = $typeName; x = [math]::Round($rect.X); y = [math]::Round($rect.Y); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height); centerX = [math]::Round($rect.X + ($rect.Width / 2)); centerY = [math]::Round($rect.Y + ($rect.Height / 2)) })",
    "}",
    "$items | ConvertTo-Json -Compress",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_UI_CONTROL_TYPE: controlType,
        CLICKY_UI_MAX_ELEMENTS: String(maxElements),
      },
    }
  );

  if (!result.stdout) {
    return { elements: [] };
  }
  const parsed = JSON.parse(result.stdout);
  return { elements: Array.isArray(parsed) ? parsed : [parsed] };
}

async function readWindowsVisibleText(action = {}) {
  const maxElements = Math.max(1, Math.min(200, Number(action.maxTextItems || action.maxElements || action.maxItems || 120) || 120));
  const result = await listWindowsUiElements({ ...action, maxElements });
  const seen = new Set();
  const items = [];
  for (const element of result.elements || []) {
    const text = asString(element?.name).replace(/\s+/g, " ").trim();
    if (!text) continue;
    const key = `${text.toLowerCase()}|${asString(element?.controlType).toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push({
      text,
      controlType: asString(element?.controlType),
      x: Number(element?.x) || 0,
      y: Number(element?.y) || 0,
      width: Number(element?.width) || 0,
      height: Number(element?.height) || 0,
    });
  }

  return {
    text: items.map((item) => item.text).join("\n"),
    items,
  };
}

async function getWindowsElementState(action = {}) {
  if (process.platform !== "win32") {
    throw new Error("getElementState is currently supported on Windows desktop sessions only.");
  }

  const text = asString(action.text || action.label || action.name || action.target);
  if (!text) {
    throw new Error("getElementState requires text, label, name, or target.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind);
  const matchMode = asString(action.matchMode, "contains").toLowerCase() === "exact" ? "exact" : "contains";
  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 8000) || 8000));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$query = $env:CLICKY_UI_TEXT",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$matchMode = $env:CLICKY_UI_MATCH_MODE",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_UI_TIMEOUT_MS)",
    "function Find-Match {",
    "  $root = [System.Windows.Automation.AutomationElement]::RootElement",
    "  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach ($element in $all) {",
    "    $name = $element.Current.Name",
    "    if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "    $isNameMatch = if ($matchMode -eq 'exact') { [string]::Equals($name, $query, [System.StringComparison]::OrdinalIgnoreCase) } else { $name.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }",
    "    if (-not $isNameMatch) { continue }",
    "    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "    if ($controlType -and $typeName -ne $controlType) { continue }",
    "    $rect = $element.Current.BoundingRectangle",
    "    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "    $toggleState = $null",
    "    $pattern = $null",
    "    if ($element.TryGetCurrentPattern([System.Windows.Automation.TogglePattern]::Pattern, [ref]$pattern)) { $toggleState = $pattern.Current.ToggleState.ToString() }",
    "    return [pscustomobject]@{ name = $name; controlType = $typeName; isEnabled = $element.Current.IsEnabled; isOffscreen = $element.Current.IsOffscreen; isKeyboardFocusable = $element.Current.IsKeyboardFocusable; hasKeyboardFocus = $element.Current.HasKeyboardFocus; toggleState = $toggleState; x = [math]::Round($rect.X); y = [math]::Round($rect.Y); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height); centerX = [math]::Round($rect.X + ($rect.Width / 2)); centerY = [math]::Round($rect.Y + ($rect.Height / 2)) }",
    "  }",
    "  return $null",
    "}",
    "do {",
    "  $match = Find-Match",
    "  if ($match) { $match | ConvertTo-Json -Compress; exit 0 }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No visible UI element matched '$query'.\"",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_UI_TEXT: text,
        CLICKY_UI_CONTROL_TYPE: controlType,
        CLICKY_UI_MATCH_MODE: matchMode,
        CLICKY_UI_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  return JSON.parse(result.stdout);
}

async function getWindowsElementValue(action = {}) {
  if (process.platform !== "win32") {
    throw new Error("getElementValue is currently supported on Windows desktop sessions only.");
  }

  const text = asString(action.text || action.label || action.name || action.target);
  if (!text) {
    throw new Error("getElementValue requires text, label, name, or target.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind || "edit");
  const matchMode = asString(action.matchMode, "contains").toLowerCase() === "exact" ? "exact" : "contains";
  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 8000) || 8000));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$query = $env:CLICKY_UI_TEXT",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$matchMode = $env:CLICKY_UI_MATCH_MODE",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_UI_TIMEOUT_MS)",
    "function Find-Match {",
    "  $root = [System.Windows.Automation.AutomationElement]::RootElement",
    "  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach ($element in $all) {",
    "    $name = $element.Current.Name",
    "    if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "    $isNameMatch = if ($matchMode -eq 'exact') { [string]::Equals($name, $query, [System.StringComparison]::OrdinalIgnoreCase) } else { $name.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }",
    "    if (-not $isNameMatch) { continue }",
    "    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "    if ($controlType -and $typeName -ne $controlType) { continue }",
    "    $rect = $element.Current.BoundingRectangle",
    "    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "    return [pscustomobject]@{ element = $element; name = $name; controlType = $typeName; x = [math]::Round($rect.X); y = [math]::Round($rect.Y); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height); centerX = [math]::Round($rect.X + ($rect.Width / 2)); centerY = [math]::Round($rect.Y + ($rect.Height / 2)) }",
    "  }",
    "  return $null",
    "}",
    "do {",
    "  $match = Find-Match",
    "  if ($match) {",
    "    $pattern = $null",
    "    if (-not $match.element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { throw \"UI element '$($match.name)' does not support ValuePattern.\" }",
    "    $currentValue = $pattern.Current.Value",
    "    [pscustomobject]@{ name = $match.name; controlType = $match.controlType; value = $currentValue; valueLength = $currentValue.Length; isReadOnly = $pattern.Current.IsReadOnly; x = $match.x; y = $match.y; width = $match.width; height = $match.height; centerX = $match.centerX; centerY = $match.centerY } | ConvertTo-Json -Compress",
    "    exit 0",
    "  }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No visible UI element matched '$query'.\"",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_UI_TEXT: text,
        CLICKY_UI_CONTROL_TYPE: controlType,
        CLICKY_UI_MATCH_MODE: matchMode,
        CLICKY_UI_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  return JSON.parse(result.stdout);
}

async function invokeWindowsUiElement(action = {}) {
  if (process.platform !== "win32") {
    throw new Error("invokeElement is currently supported on Windows desktop sessions only.");
  }

  const text = asString(action.text || action.label || action.name || action.target);
  if (!text) {
    throw new Error("invokeElement requires text, label, name, or target.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind);
  const matchMode = asString(action.matchMode, "contains").toLowerCase() === "exact" ? "exact" : "contains";
  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 8000) || 8000));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$query = $env:CLICKY_UI_TEXT",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$matchMode = $env:CLICKY_UI_MATCH_MODE",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_UI_TIMEOUT_MS)",
    "function Find-Match {",
    "  $root = [System.Windows.Automation.AutomationElement]::RootElement",
    "  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach ($element in $all) {",
    "    $name = $element.Current.Name",
    "    if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "    $isNameMatch = if ($matchMode -eq 'exact') { [string]::Equals($name, $query, [System.StringComparison]::OrdinalIgnoreCase) } else { $name.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }",
    "    if (-not $isNameMatch) { continue }",
    "    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "    if ($controlType -and $typeName -ne $controlType) { continue }",
    "    $rect = $element.Current.BoundingRectangle",
    "    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "    return [pscustomobject]@{ element = $element; name = $name; controlType = $typeName; x = [math]::Round($rect.X); y = [math]::Round($rect.Y); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height); centerX = [math]::Round($rect.X + ($rect.Width / 2)); centerY = [math]::Round($rect.Y + ($rect.Height / 2)) }",
    "  }",
    "  return $null",
    "}",
    "do {",
    "  $match = Find-Match",
    "  if ($match) {",
    "    $pattern = $null",
    "    if (-not $match.element.TryGetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern, [ref]$pattern)) { throw \"UI element '$($match.name)' does not support InvokePattern.\" }",
    "    $pattern.Invoke()",
    "    [pscustomobject]@{ name = $match.name; controlType = $match.controlType; invoked = $true; x = $match.x; y = $match.y; width = $match.width; height = $match.height; centerX = $match.centerX; centerY = $match.centerY } | ConvertTo-Json -Compress",
    "    exit 0",
    "  }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No visible UI element matched '$query'.\"",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_UI_TEXT: text,
        CLICKY_UI_CONTROL_TYPE: controlType,
        CLICKY_UI_MATCH_MODE: matchMode,
        CLICKY_UI_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  return JSON.parse(result.stdout);
}

async function setWindowsElementValue(action = {}) {
  if (process.platform !== "win32") {
    throw new Error("setElementValue is currently supported on Windows desktop sessions only.");
  }

  const text = asString(action.text || action.label || action.name || action.target);
  if (!text) {
    throw new Error("setElementValue requires text, label, name, or target.");
  }

  const value = firstRawString(action.value, action.textToSet, action.input, action.content);
  if (typeof value !== "string") {
    throw new Error("setElementValue requires value, textToSet, input, or content.");
  }

  const controlType = normalizeUiControlType(action.controlType || action.role || action.kind || "edit");
  const matchMode = asString(action.matchMode, "contains").toLowerCase() === "exact" ? "exact" : "contains";
  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 8000) || 8000));
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName UIAutomationClient",
    "Add-Type -AssemblyName UIAutomationTypes",
    "$query = $env:CLICKY_UI_TEXT",
    "$value = $env:CLICKY_UI_VALUE",
    "$controlType = $env:CLICKY_UI_CONTROL_TYPE",
    "$matchMode = $env:CLICKY_UI_MATCH_MODE",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_UI_TIMEOUT_MS)",
    "function Find-Match {",
    "  $root = [System.Windows.Automation.AutomationElement]::RootElement",
    "  $all = $root.FindAll([System.Windows.Automation.TreeScope]::Subtree, [System.Windows.Automation.Condition]::TrueCondition)",
    "  foreach ($element in $all) {",
    "    $name = $element.Current.Name",
    "    if ([string]::IsNullOrWhiteSpace($name)) { continue }",
    "    $isNameMatch = if ($matchMode -eq 'exact') { [string]::Equals($name, $query, [System.StringComparison]::OrdinalIgnoreCase) } else { $name.IndexOf($query, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 }",
    "    if (-not $isNameMatch) { continue }",
    "    $typeName = $element.Current.ControlType.ProgrammaticName -replace '^ControlType\\.', ''",
    "    if ($controlType -and $typeName -ne $controlType) { continue }",
    "    $rect = $element.Current.BoundingRectangle",
    "    if ($rect.Width -le 0 -or $rect.Height -le 0) { continue }",
    "    return [pscustomobject]@{ element = $element; name = $name; controlType = $typeName; x = [math]::Round($rect.X); y = [math]::Round($rect.Y); width = [math]::Round($rect.Width); height = [math]::Round($rect.Height); centerX = [math]::Round($rect.X + ($rect.Width / 2)); centerY = [math]::Round($rect.Y + ($rect.Height / 2)) }",
    "  }",
    "  return $null",
    "}",
    "do {",
    "  $match = Find-Match",
    "  if ($match) {",
    "    $pattern = $null",
    "    if (-not $match.element.TryGetCurrentPattern([System.Windows.Automation.ValuePattern]::Pattern, [ref]$pattern)) { throw \"UI element '$($match.name)' does not support ValuePattern.\" }",
    "    if ($pattern.Current.IsReadOnly) { throw \"UI element '$($match.name)' is read-only.\" }",
    "    $pattern.SetValue($value)",
    "    [pscustomobject]@{ name = $match.name; controlType = $match.controlType; valueLength = $value.Length; x = $match.x; y = $match.y; width = $match.width; height = $match.height; centerX = $match.centerX; centerY = $match.centerY } | ConvertTo-Json -Compress",
    "    exit 0",
    "  }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No visible UI element matched '$query'.\"",
  ].join("; ");

  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_UI_TEXT: text,
        CLICKY_UI_VALUE: value,
        CLICKY_UI_CONTROL_TYPE: controlType,
        CLICKY_UI_MATCH_MODE: matchMode,
        CLICKY_UI_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  return JSON.parse(result.stdout);
}

async function focusWindowsWindow(action) {
  if (process.platform !== "win32") {
    throw new Error("focusWindow is currently supported on Windows desktop sessions only.");
  }

  const titleCandidates = (
    Array.isArray(action.windowTitles)
      ? action.windowTitles
      : [action.windowTitle || action.title || action.name || action.target]
  )
    .map((value) => asString(value))
    .filter(Boolean);
  if (titleCandidates.length === 0) {
    throw new Error("focusWindow requires windowTitle, windowTitles, title, name, or target.");
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$titles = ConvertFrom-Json $env:CLICKY_WINDOW_TITLES",
    "$shell = New-Object -ComObject WScript.Shell",
    "$deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_WINDOW_TIMEOUT_MS)",
    "do {",
    "  foreach ($title in $titles) {",
    "    if ($shell.AppActivate([string]$title)) { Write-Output $title; exit 0 }",
    "  }",
    "  Start-Sleep -Milliseconds 250",
    "} while ([DateTime]::UtcNow -lt $deadline)",
    "throw \"No window matched any of: $($titles -join ', ').\"",
  ].join("; ");

  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 6000) || 6000));
  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_WINDOW_TITLES: JSON.stringify(titleCandidates),
        CLICKY_WINDOW_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  await sleep(300);
  return `Focused window matching "${result.stdout.trim() || titleCandidates[0]}".`;
}

async function listWindows() {
  if (process.platform !== "win32") {
    throw new Error("listWindows is currently supported on Windows desktop sessions only.");
  }

  const script = [
    "$ErrorActionPreference = 'Stop'",
    "Get-Process | Where-Object { $_.MainWindowTitle } | Sort-Object ProcessName, MainWindowTitle | Select-Object -First 80 @{Name='process';Expression={$_.ProcessName}}, @{Name='title';Expression={$_.MainWindowTitle}}, Id | ConvertTo-Json -Compress",
  ].join("; ");
  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    { windowsHide: true }
  );
  if (!result.stdout) {
    return { windows: [] };
  }

  const parsed = JSON.parse(result.stdout);
  const windows = (Array.isArray(parsed) ? parsed : [parsed])
    .map((entry) => ({
      process: asString(entry?.process),
      title: asString(entry?.title),
      id: Number(entry?.Id) || null,
    }))
    .filter((entry) => entry.title);

  return { windows };
}

async function setWindowsWindowState(action) {
  if (process.platform !== "win32") {
    throw new Error("setWindowState is currently supported on Windows desktop sessions only.");
  }

  const state = asString(action.state || action.windowState || action.mode || action.targetState).toLowerCase();
  const showCommandByState = {
    minimize: 6,
    minimized: 6,
    maximize: 3,
    maximized: 3,
    restore: 9,
    restored: 9,
    normal: 9,
  };
  const showCommand = showCommandByState[state];
  if (!showCommand) {
    throw new Error("setWindowState requires state: minimize, maximize, or restore.");
  }

  const windowTitle = asString(action.windowTitle || action.title || action.name || action.target);
  const script = [
    "$ErrorActionPreference = 'Stop'",
    "$title = $env:CLICKY_WINDOW_TITLE",
    "$showCommand = [int]$env:CLICKY_WINDOW_SHOW_COMMAND",
    "Add-Type @'",
    "using System;",
    "using System.Runtime.InteropServices;",
    "public static class ClickyWindowApi {",
    "  [DllImport(\"user32.dll\")] public static extern bool ShowWindowAsync(IntPtr hWnd, int nCmdShow);",
    "  [DllImport(\"user32.dll\")] public static extern IntPtr GetForegroundWindow();",
    "}",
    "'@",
    "if ($title) {",
    "  $deadline = [DateTime]::UtcNow.AddMilliseconds([int]$env:CLICKY_WINDOW_TIMEOUT_MS)",
    "  do {",
    "    $process = Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -and $_.MainWindowTitle.IndexOf($title, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | Select-Object -First 1",
    "    if ($process) { [ClickyWindowApi]::ShowWindowAsync($process.MainWindowHandle, $showCommand) | Out-Null; Write-Output $process.MainWindowTitle; exit 0 }",
    "    Start-Sleep -Milliseconds 250",
    "  } while ([DateTime]::UtcNow -lt $deadline)",
    "  throw \"No window matched '$title'.\"",
    "}",
    "$handle = [ClickyWindowApi]::GetForegroundWindow()",
    "if ($handle -eq [IntPtr]::Zero) { throw 'No foreground window is available.' }",
    "[ClickyWindowApi]::ShowWindowAsync($handle, $showCommand) | Out-Null",
    "Write-Output 'foreground window'",
  ].join("; ");

  const timeoutMs = Math.max(500, Math.min(15000, Number(action.timeoutMs || action.timeout || 6000) || 6000));
  const result = await readChildProcessOutput(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", script],
    {
      windowsHide: true,
      env: {
        ...process.env,
        CLICKY_WINDOW_TITLE: windowTitle,
        CLICKY_WINDOW_SHOW_COMMAND: String(showCommand),
        CLICKY_WINDOW_TIMEOUT_MS: String(timeoutMs),
      },
    }
  );
  await sleep(300);
  return `${state.replace(/ed$/i, "")}d ${result.stdout || windowTitle || "foreground window"}.`;
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

function formatFileSize(bytes) {
  const size = Number(bytes);
  if (!Number.isFinite(size) || size < 0) {
    return "";
  }

  if (size < 1024) {
    return `${size} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = size / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)} ${units[unitIndex]}`;
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
    } catch (error) {
      ignoreExpectedWorkflowFallback("reading mouse position", error);
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

  async smoothMove(targetX, targetY, signal) {
    if (!robot) return;

    const start = robot.getMousePos();
    const duration = 300;
    const steps = 15;
    const delay = Math.max(1, Math.floor(duration / steps));
    const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

    for (let i = 0; i <= steps; i++) {
      if (signal?.aborted) break;
      const t = i / steps;
      const eased = easeOutCubic(t);
      const x = start.x + (targetX - start.x) * eased;
      const y = start.y + (targetY - start.y) * eased;
      try {
        robot.moveMouse(Math.round(x), Math.round(y));
      } catch (e) {
        // ignore native movement errors
      }
      if (i < steps) {
        await sleep(delay);
      }
    }
  }

  async executeAction(action, signal) {
    switch (action.type) {
      case "screenshot": {
        return await this.captureScreenshot();
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

      case "readVisibleText":
        return await readWindowsVisibleText(action);

      case "getElementState":
        return await getWindowsElementState(action);

      case "getElementValue":
        return await getWindowsElementValue(action);

      case "invokeElement": {
        const element = await invokeWindowsUiElement(action);
        return [
          `Invoked UI element "${element.name || action.text || action.label || action.target}".`,
          `Type: ${element.controlType || "unknown"}.`,
          `Center: ${Math.round(element.centerX || 0)}, ${Math.round(element.centerY || 0)}.`,
        ].join(" ");
      }

      case "listDirectory":
        return await this.listDirectory(action);

      case "createDirectory":
        return await this.createDirectory(action);

      case "copyPath":
        return await this.copyPath(action);

      case "movePath":
        return await this.movePath(action);

      case "trashPath":
        return await this.trashPath(action);

      case "writeFile":
        return await this.writeFile(action);

      case "appendToFile":
        return await this.appendToFile(action);

      case "replaceInFile":
        return await this.replaceInFile(action);

      case "shellCommand":
        return await this.runShellCommand(action);

      case "listWindows":
        return await listWindows();

      case "listUiElements":
        return await listWindowsUiElements(action);

      case "focusWindow":
        return await focusWindowsWindow(action);

      case "setWindowState":
        return await setWindowsWindowState(action);

      case "closeWindow":
        return await this.closeWindow(action);

      case "waitForElement": {
        const element = await findWindowsUiElement(action);
        return [
          `Found UI element "${element.name || action.text || action.label || action.target}".`,
          `Type: ${element.controlType || "unknown"}.`,
          `Center: ${Math.round(element.x)}, ${Math.round(element.y)}.`,
        ].join(" ");
      }

      case "click": {
        const nativeRobot = requireRobot("click");
        const x = readFiniteNumber(action.x, "click.x");
        const y = readFiniteNumber(action.y, "click.y");
        const button = normalizeMouseButton(action.button);
        this.noteAutomatedMouseActivity();
        await this.smoothMove(Math.round(x), Math.round(y), signal);
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick(button, Boolean(action.double));
        this.noteAutomatedMouseActivity();
        return `${action.double ? "Double-clicked" : "Clicked"} ${button} button at ${Math.round(x)}, ${Math.round(y)}.`;
      }

      case "clickElement": {
        const nativeRobot = requireRobot("clickElement");
        const element = await findWindowsUiElement(action);
        const x = readFiniteNumber(element.x, "clickElement.x");
        const y = readFiniteNumber(element.y, "clickElement.y");
        const button = normalizeMouseButton(action.button);
        this.noteAutomatedMouseActivity();
        await this.smoothMove(Math.round(x), Math.round(y), signal);
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick(button, Boolean(action.double));
        this.noteAutomatedMouseActivity();
        return [
          `${action.double ? "Double-clicked" : "Clicked"} ${button} button on UI element "${element.name || action.text}".`,
          `Type: ${element.controlType || "unknown"}.`,
          `Center: ${Math.round(x)}, ${Math.round(y)}.`,
        ].join(" ");
      }

      case "typeIntoElement": {
        const nativeRobot = requireRobot("typeIntoElement");
        const element = await findWindowsUiElement({
          ...action,
          controlType: action.controlType || action.role || action.kind || "edit",
        });
        const x = readFiniteNumber(element.x, "typeIntoElement.x");
        const y = readFiniteNumber(element.y, "typeIntoElement.y");
        const value = asString(action.value ?? action.textToType ?? action.input ?? action.content ?? action.text);
        if (!value) {
          throw new Error("typeIntoElement requires value, textToType, input, content, or text.");
        }

        this.noteAutomatedMouseActivity();
        nativeRobot.moveMouse(Math.round(x), Math.round(y));
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick("left", false);
        this.noteAutomatedMouseActivity();
        await sleep(150);
        if (action.clear !== false) {
          nativeRobot.keyTap("a", process.platform === "darwin" ? ["command"] : ["control"]);
          await sleep(80);
        }
        nativeRobot.typeString(value);
        await sleep(150);
        return [
          `Typed into UI element "${element.name || action.label || action.target || action.text}".`,
          `Type: ${element.controlType || "unknown"}.`,
          `Characters: ${value.length}.`,
        ].join(" ");
      }

      case "setElementValue": {
        const element = await setWindowsElementValue(action);
        return [
          `Set value for UI element "${element.name || action.label || action.target || action.text}".`,
          `Type: ${element.controlType || "unknown"}.`,
          `Characters: ${Number(element.valueLength) || 0}.`,
        ].join(" ");
      }

      case "selectOption": {
        const nativeRobot = requireRobot("selectOption");
        const targetLabel = asString(action.text || action.label || action.name || action.target);
        const optionLabel = asString(action.option || action.value || action.optionText || action.selection);
        if (!optionLabel) {
          throw new Error("selectOption requires option, value, optionText, or selection.");
        }

        if (targetLabel) {
          const targetElement = await findWindowsUiElement({
            ...action,
            text: targetLabel,
            controlType: action.controlType || action.role || action.kind || "combobox",
          });
          const targetX = readFiniteNumber(targetElement.x, "selectOption.target.x");
          const targetY = readFiniteNumber(targetElement.y, "selectOption.target.y");
          this.noteAutomatedMouseActivity();
          nativeRobot.moveMouse(Math.round(targetX), Math.round(targetY));
          this.noteAutomatedMouseActivity();
          nativeRobot.mouseClick("left", false);
          this.noteAutomatedMouseActivity();
          await sleep(250);
        }

        const optionElement = await findWindowsUiElement({
          text: optionLabel,
          controlType: action.optionControlType || "listitem",
          matchMode: action.optionMatchMode || action.matchMode,
          timeoutMs: action.timeoutMs || action.timeout || 8000,
        });
        const optionX = readFiniteNumber(optionElement.x, "selectOption.option.x");
        const optionY = readFiniteNumber(optionElement.y, "selectOption.option.y");
        this.noteAutomatedMouseActivity();
        nativeRobot.moveMouse(Math.round(optionX), Math.round(optionY));
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick("left", false);
        this.noteAutomatedMouseActivity();
        return [
          `Selected option "${optionElement.name || optionLabel}".`,
          targetLabel ? `Target: ${targetLabel}.` : "",
          `Type: ${optionElement.controlType || "unknown"}.`,
        ].filter(Boolean).join(" ");
      }

      case "setToggleState": {
        const nativeRobot = requireRobot("setToggleState");
        const label = asString(action.text || action.label || action.name || action.target);
        if (!label) {
          throw new Error("setToggleState requires text, label, name, or target.");
        }
        const state = asString(action.state || action.checked || action.value || action.mode || "toggle").toLowerCase();
        const normalizedState =
          state === "true" || state === "on" || state === "checked" || state === "check"
            ? "checked"
            : state === "false" || state === "off" || state === "unchecked" || state === "uncheck"
              ? "unchecked"
              : "toggle";
        const element = await findWindowsUiElement({
          ...action,
          text: label,
          controlType: action.controlType || action.role || action.kind || "checkbox",
        });
        const x = readFiniteNumber(element.x, "setToggleState.x");
        const y = readFiniteNumber(element.y, "setToggleState.y");
        this.noteAutomatedMouseActivity();
        nativeRobot.moveMouse(Math.round(x), Math.round(y));
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseClick("left", false);
        this.noteAutomatedMouseActivity();
        return `${normalizedState === "toggle" ? "Toggled" : `Set ${normalizedState}`} "${element.name || label}".`;
      }

      case "moveMouse": {
        const x = readFiniteNumber(action.x, "moveMouse.x");
        const y = readFiniteNumber(action.y, "moveMouse.y");
        this.noteAutomatedMouseActivity();
        await this.smoothMove(Math.round(x), Math.round(y), signal);
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
          return [
            "Dragged mouse",
            fromX !== null && fromY !== null ? `from ${Math.round(fromX)}, ${Math.round(fromY)}` : "",
            `to ${Math.round(toX)}, ${Math.round(toY)}`,
            `with ${button} button.`,
          ].filter(Boolean).join(" ");
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

        return [
          "Dragged mouse",
          fromX !== null && fromY !== null ? `from ${Math.round(fromX)}, ${Math.round(fromY)}` : "",
          `to ${Math.round(toX)}, ${Math.round(toY)}`,
          `with ${button} button over ${durationMs}ms.`,
        ].filter(Boolean).join(" ");
      }

      case "mouseDown": {
        const nativeRobot = requireRobot("mouseDown");
        const button = normalizeMouseButton(action.button);
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseToggle("down", button);
        this.noteAutomatedMouseActivity();
        return `Mouse ${button} button held down.`;
      }

      case "mouseUp": {
        const nativeRobot = requireRobot("mouseUp");
        const button = normalizeMouseButton(action.button);
        this.noteAutomatedMouseActivity();
        nativeRobot.mouseToggle("up", button);
        this.noteAutomatedMouseActivity();
        return `Mouse ${button} button released.`;
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
        return `Typed ${text.length} character${text.length === 1 ? "" : "s"}.`;
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
        {
          const text = String(action.text ?? "");
          clipboard.writeText(text);
          return `Clipboard updated with ${text.length} character${text.length === 1 ? "" : "s"}.`;
        }

      case "getClipboard":
        {
          const text = clipboard.readText();
          return text ? `Clipboard text:\n${text}` : "Clipboard is empty.";
        }

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
        return `Scrolled ${direction} by ${normalizedAmount}.`;
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
    const dataUrl = normalizeScreenshotInputDataUrl(
      source ? source.thumbnail.toDataURL() : null
    );
    const thumbnailSize = source?.thumbnail?.getSize?.() || null;
    if (this.currentWorkflow) {
      this.currentWorkflow.screenshotDataUrl = dataUrl;
      this.currentWorkflow.updatedAt = nowIso();
    }

    if (!dataUrl) {
      return "Screenshot capture returned no image.";
    }

    const details = [
      "Screenshot captured.",
      source?.name ? `Source: ${source.name}.` : "",
      thumbnailSize?.width && thumbnailSize?.height
        ? `Size: ${thumbnailSize.width}x${thumbnailSize.height}.`
        : "",
    ].filter(Boolean);

    return details.join(" ");
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
          } catch (error) {
            ignoreExpectedWorkflowFallback("detaching launched app process", error);
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
        const startApps = await resolveWindowsStartApps(appPath);
        if (startApps.length === 0) {
          launchErrors.push("Start Menu lookup found no matching app.");
        } else {
          const startAppErrors = [];
          for (const startApp of startApps) {
            try {
              await launchWindowsStartApp(startApp);
              if (action.wait !== false) {
                await sleep(1000);
              }
              return `Launched ${startApp.name}.`;
            } catch (error) {
              startAppErrors.push(
                `${startApp.name} (${startApp.appId}): ${formatErrorMessage(error)}`
              );
            }
          }
          launchErrors.push(`Start Menu launch failed: ${startAppErrors.join("; ")}`);
        }
      } catch (error) {
        launchErrors.push(`Start Menu fallback failed: ${formatErrorMessage(error)}`);
      }

      try {
        const shortcutApp = await resolveWindowsShortcutApp(appPath);
        if (!shortcutApp) {
          launchErrors.push("Desktop/Start Menu shortcut lookup found no matching app.");
        } else {
          const openError = await shell.openPath(shortcutApp.path);
          if (openError) {
            throw new Error(openError);
          }
          if (action.wait !== false) {
            await sleep(1000);
          }
          return `Launched ${shortcutApp.name}.`;
        }
      } catch (error) {
        launchErrors.push(`shortcut fallback failed: ${formatErrorMessage(error)}`);
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

  async listDirectory(action) {
    const targetPath = asString(action.path || action.directoryPath || action.target, process.cwd());
    const resolvedPath = path.resolve(targetPath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      throw new Error(`Path is not a directory: ${resolvedPath}`);
    }

    const entries = await fs.readdir(resolvedPath, { withFileTypes: true });
    const sortedEntries = entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) {
        return left.isDirectory() ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

    const maxEntries = Math.min(
      MAX_DIRECTORY_ENTRIES,
      Math.max(1, Math.round(Number(action.maxEntries) || MAX_DIRECTORY_ENTRIES))
    );
    const visibleEntries = sortedEntries.slice(0, maxEntries);
    const lines = await Promise.all(
      visibleEntries.map(async (entry) => {
        const entryPath = path.join(resolvedPath, entry.name);
        const type = entry.isDirectory() ? "dir" : entry.isFile() ? "file" : "item";
        let detail = "";

        if (entry.isFile()) {
          try {
            const entryStats = await fs.stat(entryPath);
            detail = ` (${formatFileSize(entryStats.size)})`;
          } catch (error) {
            ignoreExpectedWorkflowFallback("reading directory entry size", error);
            detail = "";
          }
        }

        return `[${type}] ${entry.name}${detail}`;
      })
    );

    const output = [
      `Directory: ${resolvedPath}`,
      `${entries.length} item${entries.length === 1 ? "" : "s"}${entries.length > maxEntries ? `, showing first ${maxEntries}` : ""}.`,
      ...lines,
    ].join("\n");

    return output.length > MAX_DIRECTORY_OUTPUT_CHARS
      ? `${output.slice(0, MAX_DIRECTORY_OUTPUT_CHARS - 3).trimEnd()}...`
      : output;
  }

  async createDirectory(action) {
    const targetPath = asString(action.path || action.directoryPath || action.target);
    if (!targetPath) {
      throw new Error("createDirectory requires path.");
    }

    const resolvedPath = path.resolve(targetPath);
    await fs.mkdir(resolvedPath, { recursive: true });
    if (action.open === true || action.openAfterCreate === true) {
      const errorMessage = await shell.openPath(resolvedPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    } else if (action.reveal === true || action.revealAfterCreate === true) {
      shell.showItemInFolder(resolvedPath);
      await sleep(300);
    }

    const visibilityNote =
      action.open === true || action.openAfterCreate === true
        ? "Opened after creating."
        : action.reveal === true || action.revealAfterCreate === true
          ? "Revealed after creating."
          : "";
    return [`Created folder ${resolvedPath}.`, visibilityNote].filter(Boolean).join(" ");
  }

  async copyPath(action) {
    const sourcePath = asString(action.sourcePath || action.fromPath || action.path || action.filePath || action.directoryPath);
    const destinationPath = asString(action.destinationPath || action.toPath || action.target);
    if (!sourcePath || !destinationPath) {
      throw new Error("copyPath requires sourcePath and destinationPath.");
    }

    const resolvedSource = path.resolve(sourcePath);
    const resolvedDestination = path.resolve(destinationPath);
    if (resolvedSource.toLowerCase() === resolvedDestination.toLowerCase()) {
      throw new Error("copyPath source and destination must be different.");
    }

    const overwrite = action.overwrite === true || action.force === true;
    const sourceStats = await fs.stat(resolvedSource);
    try {
      await fs.lstat(resolvedDestination);
      if (!overwrite) {
        throw new Error(`Destination already exists: ${resolvedDestination}`);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(resolvedDestination), { recursive: true });
    if (sourceStats.isDirectory()) {
      await fs.cp(resolvedSource, resolvedDestination, {
        recursive: true,
        force: overwrite,
        errorOnExist: !overwrite,
      });
    } else if (sourceStats.isFile()) {
      await fs.copyFile(resolvedSource, resolvedDestination);
    } else {
      throw new Error(`Path is not a file or directory: ${resolvedSource}`);
    }

    if (action.open === true || action.openAfterCopy === true) {
      const errorMessage = await shell.openPath(resolvedDestination);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    } else if (action.reveal === true || action.revealAfterCopy === true) {
      shell.showItemInFolder(resolvedDestination);
      await sleep(300);
    }

    const visibilityNote =
      action.open === true || action.openAfterCopy === true
        ? "Opened after copying."
        : action.reveal === true || action.revealAfterCopy === true
          ? "Revealed after copying."
          : "";
    return [`Copied ${resolvedSource} to ${resolvedDestination}.`, visibilityNote].filter(Boolean).join(" ");
  }

  async movePath(action) {
    const sourcePath = asString(action.sourcePath || action.fromPath || action.path || action.filePath || action.directoryPath);
    const destinationPath = asString(action.destinationPath || action.toPath || action.target);
    if (!sourcePath || !destinationPath) {
      throw new Error("movePath requires sourcePath and destinationPath.");
    }

    const resolvedSource = path.resolve(sourcePath);
    const resolvedDestination = path.resolve(destinationPath);
    if (resolvedSource.toLowerCase() === resolvedDestination.toLowerCase()) {
      throw new Error("movePath source and destination must be different.");
    }

    const sourceStats = await fs.stat(resolvedSource);
    if (!sourceStats.isFile() && !sourceStats.isDirectory()) {
      throw new Error(`Path is not a file or directory: ${resolvedSource}`);
    }

    try {
      await fs.lstat(resolvedDestination);
      throw new Error(`Destination already exists: ${resolvedDestination}`);
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(resolvedDestination), { recursive: true });
    await fs.rename(resolvedSource, resolvedDestination);
    if (action.open === true || action.openAfterMove === true) {
      const errorMessage = await shell.openPath(resolvedDestination);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    } else if (action.reveal === true || action.revealAfterMove === true) {
      shell.showItemInFolder(resolvedDestination);
      await sleep(300);
    }

    const visibilityNote =
      action.open === true || action.openAfterMove === true
        ? "Opened after moving."
        : action.reveal === true || action.revealAfterMove === true
          ? "Revealed after moving."
          : "";
    return [`Moved ${resolvedSource} to ${resolvedDestination}.`, visibilityNote].filter(Boolean).join(" ");
  }

  async trashPath(action) {
    const targetPath = asString(action.path || action.filePath || action.directoryPath || action.target || action.sourcePath || action.fromPath);
    if (!targetPath) {
      throw new Error("trashPath requires path.");
    }

    const resolvedPath = path.resolve(targetPath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile() && !stats.isDirectory()) {
      throw new Error(`Path is not a file or directory: ${resolvedPath}`);
    }
    if (typeof shell.trashItem !== "function") {
      throw new Error("Trash is not supported in this desktop runtime.");
    }

    await shell.trashItem(resolvedPath);
    await sleep(300);
    return `Moved ${resolvedPath} to trash.`;
  }

  async writeFile(action) {
    const filePath = asString(action.filePath || action.path || action.target);
    if (!filePath) {
      throw new Error("writeFile requires filePath.");
    }

    const resolvedPath = path.resolve(filePath);
    let backupPath = "";
    try {
      const existingStats = await fs.stat(resolvedPath);
      if (existingStats.isFile() && action.backup !== false) {
        backupPath = `${resolvedPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
        await fs.copyFile(resolvedPath, backupPath);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, String(action.content ?? ""), "utf8");
    if (action.reveal === true || action.revealAfterWrite === true) {
      shell.showItemInFolder(resolvedPath);
      await sleep(300);
    }
    if (action.open === true || action.openAfterWrite === true) {
      const errorMessage = await shell.openPath(resolvedPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    }

    const visibilityNote =
      action.open === true || action.openAfterWrite === true
        ? "Opened after writing."
        : action.reveal === true || action.revealAfterWrite === true
          ? "Revealed after writing."
          : "";
    return [
      `Wrote ${resolvedPath}.`,
      backupPath ? `Backup: ${backupPath}.` : "",
      visibilityNote,
    ].filter(Boolean).join(" ");
  }

  async appendToFile(action) {
    const filePath = asString(action.filePath || action.path || action.target);
    const appendContent = firstRawString(action.content, action.text, action.append, action.value);
    if (!filePath) {
      throw new Error("appendToFile requires filePath.");
    }
    if (typeof appendContent !== "string" || appendContent.length === 0) {
      throw new Error("appendToFile requires non-empty content.");
    }

    const resolvedPath = path.resolve(filePath);
    let original = "";
    let backupPath = "";
    try {
      const existingStats = await fs.stat(resolvedPath);
      if (!existingStats.isFile()) {
        throw new Error(`Path is not a file: ${resolvedPath}`);
      }
      if (existingStats.size > MAX_TEXT_FILE_SIZE_BYTES) {
        throw new Error(`File is too large to edit as text: ${resolvedPath}`);
      }
      original = await fs.readFile(resolvedPath, "utf8");
      if (action.backup !== false) {
        backupPath = `${resolvedPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
        await fs.copyFile(resolvedPath, backupPath);
      }
    } catch (error) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
    }

    const shouldManageNewline = action.newline !== false && action.appendNewline !== false;
    let nextContent = original;
    if (shouldManageNewline) {
      if (nextContent.length > 0 && !nextContent.endsWith("\n")) {
        nextContent += "\n";
      }
      nextContent += appendContent;
      if (!nextContent.endsWith("\n")) {
        nextContent += "\n";
      }
    } else {
      nextContent += appendContent;
    }

    await fs.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.writeFile(resolvedPath, nextContent, "utf8");
    if (action.reveal === true || action.revealAfterAppend === true || action.revealAfterWrite === true) {
      shell.showItemInFolder(resolvedPath);
      await sleep(300);
    }
    if (action.open === true || action.openAfterAppend === true || action.openAfterWrite === true) {
      const errorMessage = await shell.openPath(resolvedPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    }

    const visibilityNote =
      action.open === true || action.openAfterAppend === true || action.openAfterWrite === true
        ? "Opened after appending."
        : action.reveal === true || action.revealAfterAppend === true || action.revealAfterWrite === true
          ? "Revealed after appending."
          : "";
    return [
      `Appended to ${resolvedPath}.`,
      backupPath ? `Backup: ${backupPath}.` : "",
      visibilityNote,
    ].filter(Boolean).join(" ");
  }

  async replaceInFile(action) {
    const filePath = asString(action.filePath || action.path || action.target);
    const searchText = firstRawString(action.search, action.find, action.oldText, action.fromText);
    const replacementText = firstRawString(action.replacement, action.replaceWith, action.newText, action.toText);
    if (!filePath) {
      throw new Error("replaceInFile requires filePath.");
    }
    if (typeof searchText !== "string" || searchText.length === 0) {
      throw new Error("replaceInFile requires non-empty search text.");
    }
    if (typeof replacementText !== "string") {
      throw new Error("replaceInFile requires replacement text.");
    }

    const resolvedPath = path.resolve(filePath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isFile()) {
      throw new Error(`Path is not a file: ${resolvedPath}`);
    }
    if (stats.size > MAX_TEXT_FILE_SIZE_BYTES) {
      throw new Error(`File is too large to edit as text: ${resolvedPath}`);
    }

    const original = await fs.readFile(resolvedPath, "utf8");
    let nextContent = original;
    let replacementCount = 0;
    if (action.all === true || action.replaceAll === true) {
      const parts = original.split(searchText);
      replacementCount = parts.length - 1;
      nextContent = parts.join(replacementText);
    } else {
      const index = original.indexOf(searchText);
      if (index >= 0) {
        replacementCount = 1;
        nextContent = `${original.slice(0, index)}${replacementText}${original.slice(index + searchText.length)}`;
      }
    }

    if (replacementCount <= 0) {
      throw new Error(`Search text was not found in ${resolvedPath}.`);
    }

    let backupPath = "";
    if (action.backup !== false) {
      backupPath = `${resolvedPath}.${new Date().toISOString().replace(/[:.]/g, "-")}.bak`;
      await fs.copyFile(resolvedPath, backupPath);
    }

    await fs.writeFile(resolvedPath, nextContent, "utf8");
    if (action.reveal === true || action.revealAfterReplace === true || action.revealAfterWrite === true) {
      shell.showItemInFolder(resolvedPath);
      await sleep(300);
    }
    if (action.open === true || action.openAfterReplace === true || action.openAfterWrite === true) {
      const errorMessage = await shell.openPath(resolvedPath);
      if (errorMessage) {
        throw new Error(errorMessage);
      }
      await sleep(500);
    }

    const visibilityNote =
      action.open === true || action.openAfterReplace === true || action.openAfterWrite === true
        ? "Opened after replacing."
        : action.reveal === true || action.revealAfterReplace === true || action.revealAfterWrite === true
          ? "Revealed after replacing."
          : "";
    return [
      `Replaced ${replacementCount} occurrence${replacementCount === 1 ? "" : "s"} in ${resolvedPath}.`,
      backupPath ? `Backup: ${backupPath}.` : "",
      visibilityNote,
    ].filter(Boolean).join(" ");
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
