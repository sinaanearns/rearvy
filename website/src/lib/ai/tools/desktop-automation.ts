/**
 * Desktop automation tools.
 * These tools only prepare workflow payloads; Electron executes them through IPC.
 */

import type { ToolContext } from "../types";
import type { Workflow } from "@/lib/ai/desktop-control/types";
import {
  WORKFLOW_TEMPLATES,
  createWorkflowFromTemplate,
} from "@/lib/ai/desktop-control/workflow-templates";

type DesktopWorkflowSource = "chat-tool" | "template" | "test";

type DesktopWorkflowStepInput = {
  id?: string;
  name?: string;
  description?: string;
  action?: { type?: string; [key: string]: unknown };
  timeout?: number;
  retry?: { max?: number; backoffMs?: number };
};

type DesktopWorkflowPayload = {
  id: string;
  name: string;
  description?: string;
  source: DesktopWorkflowSource;
  requiresApproval: boolean;
  steps: Array<{
    id: string;
    name: string;
    description?: string;
    action: { type: string; [key: string]: unknown };
    timeout?: number;
    retry?: { max: number; backoffMs: number };
  }>;
};

type WriteFileRequest = {
  path: string;
  content: string;
};

type AppendToFileRequest = {
  path: string;
  content: string;
  openAfterAppend: boolean;
};

type ReplaceInFileRequest = {
  path: string;
  search: string;
  replacement: string;
  replaceAll: boolean;
  openAfterReplace: boolean;
};

type CreateDirectoryRequest = {
  path: string;
  openAfterCreate: boolean;
};

type CopyPathRequest = {
  sourcePath: string;
  destinationPath: string;
  overwrite: boolean;
  openAfterCopy: boolean;
};

type MovePathRequest = {
  sourcePath: string;
  destinationPath: string;
  openAfterMove: boolean;
};

type TrashPathRequest = {
  path: string;
};

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
  "closeWindow",
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

const COMMAND_PREFIX_PATTERN =
  /^(?:npm(?:\.cmd)?|npx(?:\.cmd)?|pnpm|yarn|bun|node|tsx|ts-node|python|py|uv|pip|git|gh|vercel|next|tsc|eslint|prettier|vitest|jest|pytest|cargo|go|rustc|deno|docker|docker-compose|powershell|pwsh|cmd|bash|sh|dir|ls|echo|type|cat|where|which|cd|\.\\|\.\/)\b/i;

const ACTION_PARAMETER_SCHEMA = {
  type: "object" as const,
  description:
    "Desktop action payload. Use path/filePath/directoryPath for local filesystem work, appPath/url for app or website opening, command/cwd for terminal work, content for generated artifacts, and reveal/open flags when the user should immediately see created output.",
  properties: {
    type: {
      type: "string",
      enum: Array.from(ALLOWED_ACTION_TYPES),
      description: "Action type to execute after user approval.",
    },
    appPath: {
      type: "string",
      description: "App name, executable path, or URL for launchApp/openPath.",
    },
    url: {
      type: "string",
      description: "Website URL for openPath/launchApp browser-opening steps.",
    },
    path: {
      type: "string",
      description: "Local file or folder path, including the target for trashPath.",
    },
    filePath: {
      type: "string",
      description: "Local file path for readFile, writeFile, appendToFile, replaceInFile, or revealPath.",
    },
    directoryPath: {
      type: "string",
      description: "Local folder path for listDirectory or createDirectory.",
    },
    sourcePath: {
      type: "string",
      description: "Source file or folder path for copyPath, movePath, or trashPath.",
    },
    destinationPath: {
      type: "string",
      description: "Destination file or folder path for copyPath or movePath.",
    },
    fromPath: {
      type: "string",
      description: "Alias for sourcePath in copyPath, movePath, or trashPath.",
    },
    toPath: {
      type: "string",
      description: "Alias for destinationPath in copyPath or movePath.",
    },
    target: {
      type: "string",
      description: "Generic local target path when path/filePath/directoryPath is not used.",
    },
    content: {
      type: "string",
      description: "Full UTF-8 file content for writeFile steps, or text to append for appendToFile.",
    },
    append: {
      type: "string",
      description: "Alias for content in appendToFile.",
    },
    search: {
      type: "string",
      description: "Exact text to find for replaceInFile.",
    },
    find: {
      type: "string",
      description: "Alias for search in replaceInFile.",
    },
    oldText: {
      type: "string",
      description: "Alias for search in replaceInFile.",
    },
    fromText: {
      type: "string",
      description: "Alias for search in replaceInFile.",
    },
    replacement: {
      type: "string",
      description: "Replacement text for replaceInFile.",
    },
    replaceWith: {
      type: "string",
      description: "Alias for replacement in replaceInFile.",
    },
    newText: {
      type: "string",
      description: "Alias for replacement in replaceInFile.",
    },
    toText: {
      type: "string",
      description: "Alias for replacement in replaceInFile.",
    },
    replaceAll: {
      type: "boolean",
      description: "For replaceInFile, replace every occurrence only when explicitly requested.",
    },
    all: {
      type: "boolean",
      description: "Alias for replaceAll in replaceInFile.",
    },
    maxEntries: {
      type: "number",
      description: "Maximum entries to return for listDirectory.",
    },
    maxElements: {
      type: "number",
      description: "Maximum visible UI elements to return for listUiElements.",
    },
    maxTextItems: {
      type: "number",
      description: "Maximum visible text items to return for readVisibleText.",
    },
    command: {
      type: "string",
      description: "Shell command for shellCommand. Destructive commands are blocked.",
    },
    cwd: {
      type: "string",
      description: "Working directory for shellCommand.",
    },
    args: {
      type: "array",
      items: { type: "string" },
      description: "Optional launch arguments.",
    },
    wait: {
      type: "boolean",
      description: "Wait briefly after launching or opening.",
    },
    backup: {
      type: "boolean",
      description: "For writeFile, appendToFile, or replaceInFile, keep the default true backup behavior unless explicitly false.",
    },
    newline: {
      type: "boolean",
      description: "For appendToFile, add sensible line breaks around appended text unless explicitly false.",
    },
    appendNewline: {
      type: "boolean",
      description: "Alias for newline in appendToFile.",
    },
    overwrite: {
      type: "boolean",
      description: "For copyPath, overwrite the destination only when the user explicitly asked.",
    },
    reveal: {
      type: "boolean",
      description: "Reveal a created or existing path in the file manager.",
    },
    revealAfterCreate: {
      type: "boolean",
      description: "For createDirectory, reveal the new folder after creating it.",
    },
    revealAfterCopy: {
      type: "boolean",
      description: "For copyPath, reveal the copied file or folder after copying it.",
    },
    revealAfterMove: {
      type: "boolean",
      description: "For movePath, reveal the moved or renamed file or folder after moving it.",
    },
    revealAfterWrite: {
      type: "boolean",
      description: "For writeFile, reveal the written file after creating it.",
    },
    revealAfterAppend: {
      type: "boolean",
      description: "For appendToFile, reveal the edited file after appending text.",
    },
    revealAfterReplace: {
      type: "boolean",
      description: "For replaceInFile, reveal the edited file after replacing text.",
    },
    open: {
      type: "boolean",
      description: "Open the target after the action when useful.",
    },
    openAfterCreate: {
      type: "boolean",
      description: "For createDirectory, open the new folder after creating it.",
    },
    openAfterCopy: {
      type: "boolean",
      description: "For copyPath, open the copied file or folder after copying it.",
    },
    openAfterMove: {
      type: "boolean",
      description: "For movePath, open the moved or renamed file or folder after moving it.",
    },
    openAfterWrite: {
      type: "boolean",
      description: "For writeFile, open the written file after creating it.",
    },
    openAfterAppend: {
      type: "boolean",
      description: "For appendToFile, open the edited file after appending text.",
    },
    openAfterReplace: {
      type: "boolean",
      description: "For replaceInFile, open the edited file after replacing text.",
    },
    x: { type: "number", description: "Screen x coordinate for pointer actions." },
    y: { type: "number", description: "Screen y coordinate for pointer actions." },
    fromX: { type: "number", description: "Drag start x coordinate." },
    fromY: { type: "number", description: "Drag start y coordinate." },
    toX: { type: "number", description: "Drag end x coordinate." },
    toY: { type: "number", description: "Drag end y coordinate." },
    durationMs: {
      type: "number",
      description: "Duration in milliseconds for dragMouse smooth movement.",
    },
    steps: {
      type: "number",
      description: "Interpolation steps for dragMouse smooth movement.",
    },
    button: {
      type: "string",
      enum: ["left", "right", "middle"],
      description: "Mouse button for pointer actions.",
    },
    double: { type: "boolean", description: "Double-click for click actions." },
    text: {
      type: "string",
      description: "Text for type, setClipboard, appendToFile, clickElement, invokeElement, or the target label for typeIntoElement/setElementValue/getElementValue actions.",
    },
    value: {
      type: "string",
      description: "Value to type/set for typeIntoElement or setElementValue actions, option value for selectOption, or alias for content in appendToFile.",
    },
    option: {
      type: "string",
      description: "Option label to choose for selectOption.",
    },
    optionText: {
      type: "string",
      description: "Alias for option in selectOption actions.",
    },
    selection: {
      type: "string",
      description: "Alias for option in selectOption actions.",
    },
    controlType: {
      type: "string",
      description: "Optional UI Automation control type hint for waitForElement/clickElement/invokeElement/typeIntoElement/setElementValue/getElementValue/selectOption, such as button, edit, link, tab, menuitem, combobox, listitem, or checkbox.",
    },
    optionControlType: {
      type: "string",
      description: "Optional control type hint for the selectable option in selectOption.",
    },
    matchMode: {
      type: "string",
      enum: ["contains", "exact"],
      description: "Optional label matching mode for named UI element actions.",
    },
    delay: {
      type: "number",
      description: "Delay in milliseconds between typed characters.",
    },
    delayMs: {
      type: "number",
      description: "Delay in milliseconds between typed characters.",
    },
    clear: {
      type: "boolean",
      description: "For typeIntoElement, select existing field text before typing unless explicitly false.",
    },
    key: {
      type: "string",
      description: "Key or shortcut for keyPress, such as Enter or Control+c.",
    },
    modifiers: {
      type: "array",
      items: { type: "string" },
      description: "Optional key modifiers for keyPress.",
    },
    direction: {
      type: "string",
      enum: ["up", "down", "left", "right"],
      description: "Scroll direction.",
    },
    amount: {
      type: "number",
      description: "Scroll amount or max list entries depending on action.",
    },
    ms: {
      type: "number",
      description: "Wait duration in milliseconds.",
    },
    analyze: {
      type: "boolean",
      description: "For screenshot, request follow-up visual analysis when available.",
    },
    windowTitle: {
      type: "string",
      description: "Target window title for focusWindow, or optional target title for closeWindow when supported.",
    },
    title: {
      type: "string",
      description: "Alias for windowTitle in focusWindow and setWindowState actions.",
    },
    state: {
      type: "string",
      enum: ["minimize", "maximize", "restore", "checked", "unchecked", "toggle"],
      description: "Window state for setWindowState, or target state for setToggleState.",
    },
    windowState: {
      type: "string",
      enum: ["minimize", "maximize", "restore"],
      description: "Alias for state in setWindowState actions.",
    },
    force: {
      type: "boolean",
      description: "For closeWindow, use a forceful active-window close shortcut when needed.",
    },
    timeoutMs: {
      type: "number",
      description: "Timeout in milliseconds for waitForElement or named UI lookup actions.",
    },
  },
  additionalProperties: true,
};

function makeWorkflowId(prefix = "desktop_workflow") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function hasDangerousActionText(value: unknown, actionType = "") {
  const record = value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
  if (!record) {
    return false;
  }

  const command = typeof record?.command === "string" ? record.command : "";
  if (actionType === "shellCommand" && DANGEROUS_COMMAND_PATTERNS.some((pattern) => pattern.test(command))) {
    return true;
  }

  const copyDestinationPath = [record?.destinationPath, record?.toPath, record?.target]
    .find((item): item is string => typeof item === "string") ?? "";
  if (actionType === "copyPath" && PROTECTED_PATH_PATTERN.test(copyDestinationPath)) {
    return true;
  }
  const moveSourcePath = [record?.sourcePath, record?.fromPath, record?.path, record?.filePath, record?.directoryPath]
    .find((item): item is string => typeof item === "string") ?? "";
  if (
    actionType === "movePath" &&
    (PROTECTED_PATH_PATTERN.test(moveSourcePath) || PROTECTED_PATH_PATTERN.test(copyDestinationPath))
  ) {
    return true;
  }

  const targetPath = [record?.path, record?.filePath, record?.directoryPath, record?.target]
    .find((item): item is string => typeof item === "string") ?? "";
  if (
    (actionType === "writeFile" ||
      actionType === "appendToFile" ||
      actionType === "replaceInFile" ||
      actionType === "createDirectory") &&
    PROTECTED_PATH_PATTERN.test(targetPath)
  ) {
    return true;
  }
  const trashTargetPath = [record?.path, record?.filePath, record?.directoryPath, record?.target, record?.sourcePath, record?.fromPath]
    .find((item): item is string => typeof item === "string") ?? "";
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

function normalizeAction(action: DesktopWorkflowStepInput["action"]) {
  if (!action || typeof action !== "object") {
    throw new Error("Each workflow step needs an action object.");
  }

  const type = typeof action.type === "string" ? action.type.trim() : "";
  if (!ALLOWED_ACTION_TYPES.has(type)) {
    throw new Error(`Unsupported desktop action type: ${type || "unknown"}`);
  }

  if (hasDangerousActionText(action, type)) {
    throw new Error("This workflow contains a potentially destructive action and was blocked.");
  }

  return { ...action, type };
}

function normalizeStep(step: DesktopWorkflowStepInput, index: number) {
  const action = normalizeAction(step.action);

  return {
    id: typeof step.id === "string" && step.id.trim() ? step.id.trim() : `step_${index + 1}`,
    name: typeof step.name === "string" && step.name.trim() ? step.name.trim() : `Step ${index + 1}`,
    description: typeof step.description === "string" ? step.description : undefined,
    action,
    timeout:
      typeof step.timeout === "number" && Number.isFinite(step.timeout)
        ? Math.max(500, step.timeout)
        : undefined,
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
        : undefined,
  };
}

function canRunWithoutApproval(
  source: DesktopWorkflowSource,
  steps: ReturnType<typeof normalizeStep>[]
) {
  return (
    source === "chat-tool" &&
    steps.length === 1 &&
    steps[0]?.action.type === "screenshot"
  );
}

function createWorkflowPayload(params: {
  id?: string;
  name?: string;
  description?: string;
  source: DesktopWorkflowSource;
  steps: DesktopWorkflowStepInput[];
}): DesktopWorkflowPayload {
  if (!params.steps.length) {
    throw new Error("Workflow must include at least one executable step.");
  }

  const steps = params.steps.map(normalizeStep);

  return {
    id: typeof params.id === "string" && params.id.trim() ? params.id.trim() : makeWorkflowId(),
    name: typeof params.name === "string" && params.name.trim() ? params.name.trim() : "Desktop Workflow",
    description: params.description,
    source: params.source,
    requiresApproval: !canRunWithoutApproval(params.source, steps),
    steps,
  };
}

function workflowFromTemplate(workflow: Workflow, source: DesktopWorkflowSource): DesktopWorkflowPayload {
  return createWorkflowPayload({
    id: workflow.id,
    name: workflow.name,
    description: workflow.metadata?.type ? String(workflow.metadata.type) : undefined,
    source,
    steps: workflow.steps.map((step) => ({
      id: step.id,
      name: step.name,
      description: step.description,
      action: step.action as { type?: string; [key: string]: unknown },
      timeout: step.timeout,
      retry: step.retry,
    })),
  });
}

function parseWaitMs(description: string) {
  const match = description.match(/\bwait(?:\s+for)?\s+(\d+(?:\.\d+)?)\s*(milliseconds?|ms|seconds?|secs?|s)?\b/i);
  if (!match) {
    return null;
  }

  const amount = Number(match[1]);
  const unit = (match[2] || "seconds").toLowerCase();
  if (!Number.isFinite(amount)) {
    return null;
  }

  return unit === "ms" || unit.startsWith("millisecond")
    ? Math.round(amount)
    : Math.round(amount * 1000);
}

function firstQuotedValue(description: string) {
  const match = description.match(/["'`]([^"'`]+)["'`]/);
  return match?.[1]?.trim() || null;
}

function quotedValues(description: string) {
  return Array.from(description.matchAll(/["'`]([^"'`]+)["'`]/g))
    .map((match) => match[1]?.trim())
    .filter((item): item is string => Boolean(item));
}

function firstPathLikeValue(description: string) {
  const quoted = firstQuotedValue(description);
  if (quoted) {
    return quoted;
  }

  const match = description.match(
    /\b(?:[a-z]:[\\/][^\r\n"'`]+|\.{1,2}[\\/][^\r\n"'`]+|~?[\\/][^\r\n"'`]+)\b/i
  );
  return match?.[0]?.trim().replace(/[.,;]+$/g, "") || null;
}

function parseShellCommand(description: string) {
  const explicitMatch = description.match(
    /\b(?:run|execute)\s+(?:the\s+)?(?:terminal\s+|shell\s+|powershell\s+|cmd\s+)?command\s*:?\s+(.+)$/i
  );
  if (explicitMatch?.[1]) {
    return explicitMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  const quotedMatch = description.match(/\b(?:run|execute)\s+["'`]([^"'`]+)["'`]$/i);
  if (quotedMatch?.[1] && COMMAND_PREFIX_PATTERN.test(quotedMatch[1].trim())) {
    return quotedMatch[1].trim();
  }

  const terminalMatch = description.match(
    /\b(?:terminal|shell|powershell|cmd)\b[\s\S]*?\b(?:run|execute)\s+(.+)$/i
  );
  if (terminalMatch?.[1] && COMMAND_PREFIX_PATTERN.test(terminalMatch[1].trim())) {
    return terminalMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  const naturalMatch = description.match(
    /^(?:please\s+)?(?:(?:can|could|would)\s+you\s+)?(?:run|execute)\s+(.+)$/i
  );
  if (naturalMatch?.[1] && COMMAND_PREFIX_PATTERN.test(naturalMatch[1].trim())) {
    return naturalMatch[1].trim().replace(/^["'`]+|["'`]+$/g, "") || null;
  }

  return null;
}

function stripWrappingQuotes(value: string) {
  return value.trim().replace(/^["'`]+|["'`]+$/g, "");
}

function cleanWriteContent(value: string) {
  return stripWrappingQuotes(
    value.replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
  );
}

function cleanWritePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanAppendContent(value: string) {
  return stripWrappingQuotes(
    value.replace(/\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
  );
}

function cleanAppendPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|path)\s+/i, "")
      .replace(/\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanReplaceText(value: string) {
  return stripWrappingQuotes(value);
}

function cleanReplacePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|path)\s+/i, "")
      .replace(/\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+file|that\s+file)\.?$/i, "")
      .replace(/[.,;]+$/g, "")
  );
}

function cleanDirectoryPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:at|named|called)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanCopyPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+copy|the\s+copied\s+(?:file|folder|directory)|that\s+copy)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanMovePath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function cleanTrashPath(value: string) {
  return stripWrappingQuotes(
    value
      .replace(/^(?:the\s+)?(?:file|folder|directory|path)\s+/i, "")
      .replace(/\s+(?:to|into)\s+(?:the\s+)?(?:recycle\s+bin|trash)\.?$/i, "")
      .replace(
        /\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+parent\s+folder|the\s+folder)\.?$/i,
        ""
      )
      .replace(/[.,;]+$/g, "")
  );
}

function parseWriteFileRequest(description: string): WriteFileRequest | null {
  const pathFirstMatch = description.match(
    /\b(?:create|write|save)\s+(?:a\s+|the\s+)?(?:file\s+)?(.+?)\s+(?:with\s+content|containing|contents?)\s*:?\s+([\s\S]+)$/i
  );
  if (pathFirstMatch?.[1] && pathFirstMatch[2]) {
    return {
      path: cleanWritePath(pathFirstMatch[1]),
      content: cleanWriteContent(pathFirstMatch[2]),
    };
  }

  const contentFirstMatch = description.match(
    /\b(?:write|save)\s+([\s\S]+?)\s+to\s+(?:a\s+|the\s+)?(?:file\s+)?(.+?)(?:\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file))?\.?$/i
  );
  if (contentFirstMatch?.[1] && contentFirstMatch[2]) {
    return {
      path: cleanWritePath(contentFirstMatch[2]),
      content: cleanWriteContent(contentFirstMatch[1]),
    };
  }

  return null;
}

function shouldOpenAppendedFile(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:append|add)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function parseAppendToFileRequest(description: string): AppendToFileRequest | null {
  const text = description.trim();
  if (!/\b(?:append|add)(?=\s|:|$)/i.test(text) || !/\b(?:file|path)\b/i.test(text)) {
    return null;
  }

  const appendFirstQuotedMatch = text.match(
    /\b(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+["'`]([^"'`]*)["'`]\s+(?:to|into)\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`]/i
  );
  const appendFirstQuotedContent = appendFirstQuotedMatch?.[1] ?? "";
  const appendFirstQuotedPath = appendFirstQuotedMatch?.[2] ?? "";
  if (appendFirstQuotedPath && appendFirstQuotedContent.length) {
    return {
      path: cleanAppendPath(appendFirstQuotedPath),
      content: cleanAppendContent(appendFirstQuotedContent),
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  const fileFirstQuotedMatch = text.match(
    /\b(?:in|to|into)\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`][\s,]+(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+["'`]([^"'`]*)["'`]/i
  );
  const fileFirstQuotedPath = fileFirstQuotedMatch?.[1] ?? "";
  const fileFirstQuotedContent = fileFirstQuotedMatch?.[2] ?? "";
  if (fileFirstQuotedPath && fileFirstQuotedContent.length) {
    return {
      path: cleanAppendPath(fileFirstQuotedPath),
      content: cleanAppendContent(fileFirstQuotedContent),
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  const appendFirstMatch = text.match(
    /\b(?:append|add)(?:\s+(?:line|text|content|note|entry))?\s+([\s\S]+?)\s+(?:to|into)\s+(?:the\s+)?(?:file|path)\s+(.+?)(?:\s+(?:and|then)\s+(?:open|launch)\s+(?:it|the\s+file|that\s+file))?\.?$/i
  );
  if (appendFirstMatch?.[1] && appendFirstMatch[2]) {
    const content = cleanAppendContent(appendFirstMatch[1]);
    if (!content) {
      return null;
    }

    return {
      path: cleanAppendPath(appendFirstMatch[2]),
      content,
      openAfterAppend: shouldOpenAppendedFile(text),
    };
  }

  return null;
}

function shouldOpenReplacedFile(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:replace|change|edit)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function shouldReplaceAll(description: string) {
  return /\b(?:replace\s+all|all\s+occurrences|every\s+occurrence|globally)\b/i.test(description);
}

function parseReplaceInFileRequest(description: string): ReplaceInFileRequest | null {
  const text = description.trim();
  if (!/\b(?:replace|change|edit)(?=\s|:|$)/i.test(text) || !/\b(?:file|path)\b/i.test(text)) {
    return null;
  }

  const replaceFirstMatch = text.match(
    /\b(?:replace|change)\s+(?:all\s+)?["'`]([^"'`]+)["'`]\s+(?:with|to)\s+["'`]([^"'`]*)["'`]\s+in\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`]/i
  );
  if (replaceFirstMatch?.[1] && replaceFirstMatch[3]) {
    return {
      path: cleanReplacePath(replaceFirstMatch[3]),
      search: cleanReplaceText(replaceFirstMatch[1]),
      replacement: cleanReplaceText(replaceFirstMatch[2] ?? ""),
      replaceAll: shouldReplaceAll(text),
      openAfterReplace: shouldOpenReplacedFile(text),
    };
  }

  const fileFirstMatch = text.match(
    /\bin\s+(?:the\s+)?(?:file\s+|path\s+)?["'`]([^"'`]+)["'`][\s,]+(?:replace|change)\s+(?:all\s+)?["'`]([^"'`]+)["'`]\s+(?:with|to)\s+["'`]([^"'`]*)["'`]/i
  );
  if (fileFirstMatch?.[1] && fileFirstMatch[2]) {
    return {
      path: cleanReplacePath(fileFirstMatch[1]),
      search: cleanReplaceText(fileFirstMatch[2]),
      replacement: cleanReplaceText(fileFirstMatch[3] ?? ""),
      replaceAll: shouldReplaceAll(text),
      openAfterReplace: shouldOpenReplacedFile(text),
    };
  }

  return null;
}

function shouldOpenWrittenFile(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+file|that\s+file)\b|\b(?:create|write|save)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function shouldOpenCreatedDirectory(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory)\b|\b(?:create|make|new)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function shouldOpenCopiedPath(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+copy|that\s+copy|the\s+copied\s+(?:file|folder|directory))\b|\b(?:copy|duplicate)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function shouldOverwriteCopiedPath(description: string) {
  return /\b(?:overwrite|replace\s+(?:the\s+)?existing|force\s+(?:copy|overwrite))\b/i.test(description);
}

function shouldOpenMovedPath(description: string) {
  return /\b(?:open|launch)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path)\b|\b(?:move|rename)\b[\s\S]*\b(?:and|then)\s+(?:open|launch)\b/i.test(
    description
  );
}

function parseCopyPathRequest(description: string): CopyPathRequest | null {
  const text = description.trim();
  if (
    !/\b(?:copy|duplicate)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\b|["'`]|[a-z]:|\.{1,2}[\\/]|~?[\\/])/i.test(
      text
    ) ||
    /\bclipboard\b/i.test(text)
  ) {
    return null;
  }

  const quoted = quotedValues(text);
  let sourcePath = quoted[0] ? cleanCopyPath(quoted[0]) : "";
  let destinationPath = quoted[1] ? cleanCopyPath(quoted[1]) : "";

  if (!sourcePath || !destinationPath) {
    const match = text.match(
      /\b(?:copy|duplicate)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into|as)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+copy|the\s+copied\s+(?:file|folder|directory)|that\s+copy))?\.?$/i
    );
    if (match?.[1] && match[2]) {
      sourcePath = sourcePath || cleanCopyPath(match[1]);
      destinationPath = destinationPath || cleanCopyPath(match[2]);
    }
  }

  if (!sourcePath || !destinationPath) {
    return null;
  }

  const hasPathSignal =
    /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i.test(sourcePath) ||
    /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i.test(destinationPath) ||
    /\b(?:file|folder|directory|path)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return {
    sourcePath,
    destinationPath,
    overwrite: shouldOverwriteCopiedPath(text),
    openAfterCopy: shouldOpenCopiedPath(text),
  };
}

function parseMovePathRequest(description: string): MovePathRequest | null {
  const text = description.trim();
  if (
    !/\b(?:move|rename)(?=\s|:|$)/i.test(text) ||
    /\b(?:mouse|cursor|pointer|window)\b/i.test(text) ||
    /\b(?:recycle\s+bin|trash)\b/i.test(text)
  ) {
    return null;
  }

  const quoted = quotedValues(text);
  let sourcePath = quoted[0] ? cleanMovePath(quoted[0]) : "";
  let destinationPath = quoted[1] ? cleanMovePath(quoted[1]) : "";

  if (!sourcePath || !destinationPath) {
    const match = text.match(
      /\b(?:move|rename)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into|as)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+moved\s+(?:file|folder|directory)|the\s+renamed\s+(?:file|folder|directory)|the\s+new\s+path))?\.?$/i
    );
    if (match?.[1] && match[2]) {
      sourcePath = sourcePath || cleanMovePath(match[1]);
      destinationPath = destinationPath || cleanMovePath(match[2]);
    }
  }

  if (!sourcePath || !destinationPath) {
    return null;
  }

  const hasPathSignal =
    /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i.test(sourcePath) ||
    /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i.test(destinationPath) ||
    /\b(?:file|folder|directory|path)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return {
    sourcePath,
    destinationPath,
    openAfterMove: shouldOpenMovedPath(text),
  };
}

function parseTrashPathRequest(description: string): TrashPathRequest | null {
  const text = description.trim();
  const hasTrashVerb = /\b(?:trash|delete|remove)(?=\s|:|$)/i.test(text);
  const hasRecycleBinVerb =
    /\b(?:send|move)(?=\s|:|$)/i.test(text) &&
    /\b(?:recycle\s+bin|trash)\b/i.test(text);
  if (
    (!hasTrashVerb && !hasRecycleBinVerb) ||
    /\b(?:mouse|cursor|pointer|window)\b/i.test(text)
  ) {
    return null;
  }

  const quoted = quotedValues(text);
  let targetPath = quoted[0] ? cleanTrashPath(quoted[0]) : "";

  if (!targetPath) {
    const trashVerbMatch = text.match(
      /\b(?:trash|delete|remove)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+parent\s+folder|the\s+folder))?\.?$/i
    );
    const recycleBinMatch = text.match(
      /\b(?:send|move)\s+(?:the\s+)?(?:(?:file|folder|directory|path)\s+)?(.+?)\s+(?:to|into)\s+(?:the\s+)?(?:recycle\s+bin|trash)\.?$/i
    );
    targetPath = cleanTrashPath(trashVerbMatch?.[1] || recycleBinMatch?.[1] || "");
  }

  if (!targetPath) {
    return null;
  }

  const hasPathSignal =
    /^(?:[a-z]:[\\/]|~?[\\/]|\.{1,2}[\\/])/i.test(targetPath) ||
    quoted.length > 0 ||
    /\b(?:file|folder|directory|path|recycle\s+bin|trash)\b/i.test(text);
  if (!hasPathSignal) {
    return null;
  }

  return { path: targetPath };
}

function parseCreateDirectoryRequest(description: string): CreateDirectoryRequest | null {
  if (!/\b(?:create|make|new)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:folder|directory|dir)\b/i.test(description)) {
    return null;
  }

  const pathLike = firstPathLikeValue(description);
  const quoted = firstQuotedValue(description);
  const directMatch = description.match(
    /\b(?:create|make|new)\s+(?:a\s+|the\s+)?(?:new\s+)?(?:folder|directory|dir)\s+(.+?)(?:\s+(?:and|then)\s+(?:show|reveal|open|launch|locate)\s+(?:it|the\s+folder|that\s+folder|the\s+directory|that\s+directory))?\.?$/i
  );
  const candidate = pathLike ?? quoted ?? directMatch?.[1] ?? "";
  const directoryPath = cleanDirectoryPath(candidate);
  if (!directoryPath) {
    return null;
  }

  return {
    path: directoryPath,
    openAfterCreate: shouldOpenCreatedDirectory(description),
  };
}

function parseClickElementRequest(description: string) {
  const text = description.trim();
  if (!/\b(?:click|double\s+click|right\s+click|middle\s+click|press|select)\b/i.test(text)) {
    return null;
  }
  if (/\b(?:at|to|position|coordinates?)\s+(?:x\s*)?\d{1,4}\s*[,x]\s*(?:y\s*)?\d{1,4}\b/i.test(text)) {
    return null;
  }

  const quoted = firstQuotedValue(text);
  const match = text.match(
    /\b(?:click|double\s+click|right\s+click|middle\s+click|press|select)\s+(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon))?(?:\s+(?:in|on|inside|using)\s+(?:the\s+)?(?:app|application|window|screen|page|browser))?(?:\s+(?:and|then|,)\b|$)/i
  );
  const label = (quoted || match?.[1] || "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = match?.[2]?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "field" || rawControlType === "input" || rawControlType === "textbox"
      ? "edit"
      : rawControlType === "item"
        ? undefined
        : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    button: /\bright\s+click\b/i.test(text)
      ? "right"
      : /\bmiddle\s+click\b/i.test(text)
        ? "middle"
        : "left",
    double: /\bdouble\s+click\b/i.test(text),
  };
}

function parseTypeIntoElementRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:type|enter|input|fill|write)\s+(.+?)\s+(?:into|in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const value = (match[1] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:text|value)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const label = (match[2] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!value || !label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    text: label,
    value,
    controlType: "edit",
    clear: !/\b(?:without\s+clearing|append|add\s+to)\b/i.test(text),
  };
}

function parseSetElementValueRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:set|fill|change|update)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?\s+(?:to|as|with)\s+(.+?)(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1] || !match?.[3]) {
    return null;
  }

  const label = (match[1] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const value = (match[3] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:text|value)\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!value || !label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    text: label,
    value,
    controlType: "edit",
    timeoutMs: 8000,
  };
}

function parseSelectOptionRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:select|choose|pick)\s+(.+?)\s+(?:from|in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(dropdown|select|combobox|combo\s+box|menu|list|field))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1] || !match?.[2]) {
    return null;
  }

  const option = (match[1] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the\s+)?option\s+/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  const label = (match[2] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:dropdown|select|combobox|combo\s+box|menu|list|field)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!option || !label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    option,
    text: label,
    controlType: /\bmenu\b/i.test(match[3] || "") ? "menu" : "combobox",
  };
}

function parseSetToggleStateRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:(check|uncheck|toggle)|turn\s+(on|off)|set\s+(.+?)\s+(?:to\s+)?(on|off|checked|unchecked))\s+(?:the\s+)?(.+?)(?:\s+(checkbox|check\s+box|switch|toggle))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match) {
    return null;
  }

  const stateToken = (match[1] || match[2] || match[4] || "toggle").toLowerCase();
  const state = stateToken === "check" || stateToken === "on" || stateToken === "checked"
    ? "checked"
    : stateToken === "uncheck" || stateToken === "off" || stateToken === "unchecked"
      ? "unchecked"
      : "toggle";
  const label = (match[3] || match[5] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:checkbox|check\s+box|switch|toggle)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return { text: label, state, controlType: "checkbox" };
}

function parseWaitForElementRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:wait\s+(?:for|until)|wait\s+until\s+(?:the\s+)?)\s+(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown))?(?:\s+(?:appears?|is\s+visible|shows?\s+up|loads?))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const label = (match[1] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(
      /\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown)$/i,
      ""
    )
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = match[2]?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "field" || rawControlType === "input" || rawControlType === "textbox"
      ? "edit"
      : rawControlType === "dropdown"
        ? "combobox"
        : rawControlType === "item"
          ? undefined
          : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 15000,
  };
}

function parseInvokeElementRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:invoke|activate|press|trigger)\s+(?:the\s+)?(.+?)(?:\s+(button|link|tab|menu|menu\s+item|item|option|icon))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const label = (match[1] || "")
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:button|link|tab|menu|menu\s+item|item|option|icon)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = match[2]?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "menu"
      ? "menuitem"
      : rawControlType === "item"
        ? undefined
        : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 8000,
  };
}

function parseFocusWindowRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:focus|switch\s+to|bring\s+(?:up|forward|to\s+front)|activate|\bgo\s+to)\s+(?:the\s+)?(.+?)(?:\s+(?:window|app|application|browser))?(?=\s+(?:and|then|before|after)\b|,\s*|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const quoted = firstQuotedValue(match[1]);
  const windowTitle = (quoted || match[1])
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:window|app|application|browser)\b.*$/i, "")
    .replace(/\s+(?:before|after|and|then|,)\b.*$/i, "")
    .replace(/\s+(?:window|app|application|browser)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  if (!windowTitle || /^(?:current|active|window|app|application|browser|it|that|this)$/i.test(windowTitle)) {
    return null;
  }

  return { windowTitle };
}

function parseListWindowsRequest(description: string) {
  return /\b(?:list|show|what(?:'s| is)|which)\s+(?:the\s+)?(?:open|visible|active|running)?\s*(?:windows|apps|applications)\b|\b(?:open|visible|active|running)\s+(?:windows|apps|applications)\b/i.test(
    description
  );
}

function parseListUiElementsRequest(description: string) {
  if (
    !/\b(?:list|show|scan|inspect|find|what(?:'s| is)|which)\s+(?:the\s+)?(?:visible\s+|available\s+|current\s+)?(?:ui\s+)?(?:elements|controls|buttons|fields|inputs|links|tabs|menus|checkboxes)\b/i.test(
      description
    )
  ) {
    return null;
  }

  const controlType = /\bbuttons?\b/i.test(description)
    ? "button"
    : /\b(?:fields?|inputs?|textboxes?|text\s+boxes?)\b/i.test(description)
      ? "edit"
      : /\blinks?\b/i.test(description)
        ? "link"
        : /\btabs?\b/i.test(description)
          ? "tab"
          : /\bmenus?\b/i.test(description)
            ? "menuitem"
            : /\bcheckbox(?:es)?\b/i.test(description)
              ? "checkbox"
              : undefined;

  return { ...(controlType ? { controlType } : {}), maxElements: 80 };
}

function parseReadVisibleTextRequest(description: string) {
  return /\b(?:read|extract|scan|show|capture)\s+(?:the\s+)?(?:visible\s+|screen\s+|current\s+)?text(?:\s+(?:from|on|in)\s+(?:the\s+)?(?:screen|window|app|page|desktop))?\b|\bwhat\s+(?:text|words)\s+(?:is|are)\s+(?:visible|on\s+screen)\b/i.test(
    description
  );
}

function parseGetElementStateRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:get|read|check|inspect|show|tell\s+me)\s+(?:the\s+)?(?:state|status|properties|enabled|checked|visible)\s+(?:of\s+)?(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch))?(?:\s+(?:and|then|,)\b|$)|\bis\s+(?:the\s+)?(.+?)(?:\s+(button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch))?\s+(checked|unchecked|enabled|disabled|visible)\b/i
  );
  const rawLabel = match?.[1] || match?.[3] || "";
  if (!rawLabel) {
    return null;
  }

  const label = rawLabel
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(
      /\s+(?:button|field|input|textbox|text\s+box|link|tab|menu|item|checkbox|option|icon|dropdown|switch)$/i,
      ""
    )
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  const rawControlType = (match?.[2] || match?.[4])?.toLowerCase().replace(/\s+/g, "");
  const controlType =
    rawControlType === "field" || rawControlType === "input" || rawControlType === "textbox"
      ? "edit"
      : rawControlType === "dropdown"
        ? "combobox"
        : rawControlType === "switch"
          ? "checkbox"
          : rawControlType === "item"
            ? undefined
            : rawControlType;

  return {
    text: label,
    ...(controlType ? { controlType } : {}),
    timeoutMs: 8000,
  };
}

function parseGetElementValueRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(?:get|read|check|inspect|show|tell\s+me)\s+(?:the\s+)?(?:value|content|contents|text)\s+(?:of\s+|from\s+)?(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?(?:\s+(?:and|then|,)\b|$)|\bwhat(?:'s| is)\s+(?:in|inside|on)\s+(?:the\s+)?(.+?)(?:\s+(field|input|textbox|text\s+box|box|area))?\b/i
  );
  const rawLabel = match?.[1] || match?.[3] || "";
  if (!rawLabel) {
    return null;
  }

  const label = rawLabel
    .trim()
    .replace(/^["'`]+|["'`]+$/g, "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:field|input|textbox|text\s+box|box|area)$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();
  if (!label || /^(?:it|that|this|there|here|screen|window|app|application)$/i.test(label)) {
    return null;
  }

  return {
    text: label,
    controlType: "edit",
    timeoutMs: 8000,
  };
}

function parseSetWindowStateRequest(description: string) {
  const text = description.trim();
  const match = text.match(
    /\b(maximi[sz]e|minimi[sz]e|restore)\s+(?:the\s+)?(?:(current|active|foreground)\s+)?(.+?)?(?:\s+(?:window|app|application|browser))?(?:\s+(?:and|then|,)\b|$)/i
  );
  if (!match?.[1]) {
    return null;
  }

  const rawState = match[1].toLowerCase();
  const state = rawState.startsWith("max")
    ? "maximize"
    : rawState.startsWith("min")
      ? "minimize"
      : "restore";
  const windowTitle = (match[3] || "")
    .replace(/^(?:the|a|an)\s+/i, "")
    .replace(/\s+(?:window|app|application|browser)\b.*$/i, "")
    .replace(/\s+(?:before|after|and|then|,)\b.*$/i, "")
    .replace(/[.,;]+$/g, "")
    .trim();

  return {
    state,
    ...(windowTitle && !/^(?:current|active|foreground|window|app|application|browser|it|that|this)$/i.test(windowTitle)
      ? { windowTitle }
      : {}),
  };
}

function createFallbackSteps(description: string): DesktopWorkflowStepInput[] {
  const lower = description.toLowerCase();
  const steps: DesktopWorkflowStepInput[] = [];
  const waitMs = parseWaitMs(description);
  const url = description.match(/https?:\/\/[^\s)]+/i)?.[0];
  const appendRequest = parseAppendToFileRequest(description);
  const replaceRequest = parseReplaceInFileRequest(description);
  const writeRequest = parseWriteFileRequest(description);
  const createDirectoryRequest = parseCreateDirectoryRequest(description);
  const copyPathRequest = parseCopyPathRequest(description);
  const trashPathRequest = parseTrashPathRequest(description);
  const movePathRequest = parseMovePathRequest(description);
  const pathLike = firstPathLikeValue(description);
  const shellCommand = parseShellCommand(description);
  const shouldReadVisibleText = parseReadVisibleTextRequest(description);
  const getElementStateRequest = parseGetElementStateRequest(description);
  const getElementValueRequest = parseGetElementValueRequest(description);
  const invokeElementRequest = parseInvokeElementRequest(description);
  const clickElementRequest = parseClickElementRequest(description);
  const typeIntoElementRequest = parseTypeIntoElementRequest(description);
  const setElementValueRequest = parseSetElementValueRequest(description);
  const selectOptionRequest = parseSelectOptionRequest(description);
  const setToggleStateRequest = parseSetToggleStateRequest(description);
  const waitForElementRequest = parseWaitForElementRequest(description);
  const shouldListWindows = parseListWindowsRequest(description);
  const listUiElementsRequest = parseListUiElementsRequest(description);
  const focusWindowRequest = parseFocusWindowRequest(description);
  const setWindowStateRequest = parseSetWindowStateRequest(description);

  if (appendRequest) {
    steps.push({
      id: "step_append_to_file",
      name: "Append to file",
      action: {
        type: "appendToFile",
        path: appendRequest.path,
        content: appendRequest.content,
        backup: true,
        appendNewline: true,
        revealAfterAppend: true,
        openAfterAppend: appendRequest.openAfterAppend,
      },
      timeout: 10000,
    });
  } else if (replaceRequest) {
    steps.push({
      id: "step_replace_in_file",
      name: "Replace text in file",
      action: {
        type: "replaceInFile",
        path: replaceRequest.path,
        search: replaceRequest.search,
        replacement: replaceRequest.replacement,
        replaceAll: replaceRequest.replaceAll,
        backup: true,
        revealAfterReplace: true,
        openAfterReplace: replaceRequest.openAfterReplace,
      },
      timeout: 10000,
    });
  } else if (writeRequest) {
    steps.push({
      id: "step_write_file",
      name: "Write file",
      action: {
        type: "writeFile",
        path: writeRequest.path,
        content: writeRequest.content,
        revealAfterWrite: true,
        openAfterWrite: shouldOpenWrittenFile(description),
      },
      timeout: 10000,
    });
  } else if (copyPathRequest) {
    steps.push({
      id: "step_copy_path",
      name: "Copy path",
      action: {
        type: "copyPath",
        sourcePath: copyPathRequest.sourcePath,
        destinationPath: copyPathRequest.destinationPath,
        overwrite: copyPathRequest.overwrite,
        revealAfterCopy: true,
        openAfterCopy: copyPathRequest.openAfterCopy,
      },
      timeout: 30000,
    });
  } else if (trashPathRequest) {
    steps.push({
      id: "step_trash_path",
      name: "Move to trash",
      action: {
        type: "trashPath",
        path: trashPathRequest.path,
      },
      timeout: 30000,
    });
  } else if (movePathRequest) {
    steps.push({
      id: "step_move_path",
      name: "Move path",
      action: {
        type: "movePath",
        sourcePath: movePathRequest.sourcePath,
        destinationPath: movePathRequest.destinationPath,
        revealAfterMove: true,
        openAfterMove: movePathRequest.openAfterMove,
      },
      timeout: 30000,
    });
  } else if (createDirectoryRequest) {
    steps.push({
      id: "step_create_directory",
      name: "Create folder",
      action: {
        type: "createDirectory",
        path: createDirectoryRequest.path,
        revealAfterCreate: true,
        openAfterCreate: createDirectoryRequest.openAfterCreate,
      },
      timeout: 10000,
    });
  } else if (pathLike && /\b(?:reveal|show|find|locate)\b/i.test(description)) {
    steps.push({
      id: "step_reveal_path",
      name: "Reveal path",
      action: { type: "revealPath", target: pathLike },
      timeout: 5000,
    });
  } else if (pathLike && /\b(?:list|show)\s+(?:the\s+)?(?:folder|directory|files)\b/i.test(description)) {
    steps.push({
      id: "step_list_directory",
      name: "List directory",
      action: { type: "listDirectory", path: pathLike },
      timeout: 10000,
    });
  } else if (pathLike && /\b(?:read|open|inspect|summari[sz]e)\s+(?:the\s+)?(?:file|text|log|document)\b/i.test(description)) {
    steps.push({
      id: "step_read_file",
      name: "Read file",
      action: { type: "readFile", path: pathLike },
      timeout: 10000,
    });
  }

  if (shellCommand) {
    steps.push({
      id: "step_shell_command",
      name: "Run command",
      action: { type: "shellCommand", command: shellCommand },
      timeout: 30000,
    });
  }

  if (shouldListWindows) {
    steps.push({
      id: "step_list_windows",
      name: "List open windows",
      action: { type: "listWindows" },
      timeout: 10000,
    });
  }

  if (shouldReadVisibleText) {
    steps.push({
      id: "step_read_visible_text",
      name: "Read visible text",
      action: { type: "readVisibleText", maxTextItems: 120 },
      timeout: 10000,
    });
  }

  if (getElementStateRequest) {
    steps.push({
      id: "step_get_element_state",
      name: `Get ${getElementStateRequest.text} state`,
      action: {
        type: "getElementState",
        text: getElementStateRequest.text,
        ...(getElementStateRequest.controlType
          ? { controlType: getElementStateRequest.controlType }
          : {}),
        timeoutMs: getElementStateRequest.timeoutMs,
      },
      timeout: Math.max(10000, getElementStateRequest.timeoutMs + 2000),
    });
  }

  if (getElementValueRequest) {
    steps.push({
      id: "step_get_element_value",
      name: `Read ${getElementValueRequest.text} value`,
      action: {
        type: "getElementValue",
        text: getElementValueRequest.text,
        controlType: getElementValueRequest.controlType,
        timeoutMs: getElementValueRequest.timeoutMs,
      },
      timeout: Math.max(10000, getElementValueRequest.timeoutMs + 2000),
    });
  }

  if (invokeElementRequest) {
    steps.push({
      id: "step_invoke_element",
      name: `Invoke ${invokeElementRequest.text}`,
      action: {
        type: "invokeElement",
        text: invokeElementRequest.text,
        ...(invokeElementRequest.controlType
          ? { controlType: invokeElementRequest.controlType }
          : {}),
        timeoutMs: invokeElementRequest.timeoutMs,
      },
      timeout: Math.max(10000, invokeElementRequest.timeoutMs + 2000),
    });
  }

  if (listUiElementsRequest) {
    steps.push({
      id: "step_list_ui_elements",
      name: "List visible UI elements",
      action: {
        type: "listUiElements",
        ...(listUiElementsRequest.controlType
          ? { controlType: listUiElementsRequest.controlType }
          : {}),
        maxElements: listUiElementsRequest.maxElements,
      },
      timeout: 10000,
    });
  }

  if (focusWindowRequest) {
    steps.push({
      id: "step_focus_window",
      name: `Focus ${focusWindowRequest.windowTitle}`,
      action: {
        type: "focusWindow",
        windowTitle: focusWindowRequest.windowTitle,
      },
      timeout: 10000,
    });
  }

  if (setWindowStateRequest) {
    steps.push({
      id: "step_set_window_state",
      name: `${setWindowStateRequest.state[0]?.toUpperCase()}${setWindowStateRequest.state.slice(1)} window`,
      action: {
        type: "setWindowState",
        state: setWindowStateRequest.state,
        ...(setWindowStateRequest.windowTitle
          ? { windowTitle: setWindowStateRequest.windowTitle }
          : {}),
      },
      timeout: 10000,
    });
  }

  if (waitForElementRequest) {
    steps.push({
      id: "step_wait_for_element",
      name: `Wait for ${waitForElementRequest.text}`,
      action: {
        type: "waitForElement",
        text: waitForElementRequest.text,
        ...(waitForElementRequest.controlType
          ? { controlType: waitForElementRequest.controlType }
          : {}),
        timeoutMs: waitForElementRequest.timeoutMs,
      },
      timeout: Math.max(10000, waitForElementRequest.timeoutMs + 2000),
    });
  }

  if (typeIntoElementRequest) {
    steps.push({
      id: "step_type_into_element",
      name: `Type into ${typeIntoElementRequest.text}`,
      action: {
        type: "typeIntoElement",
        text: typeIntoElementRequest.text,
        value: typeIntoElementRequest.value,
        controlType: typeIntoElementRequest.controlType,
        clear: typeIntoElementRequest.clear,
      },
      timeout: Math.max(8000, typeIntoElementRequest.value.length * 100),
    });
  }

  if (setElementValueRequest) {
    steps.push({
      id: "step_set_element_value",
      name: `Set ${setElementValueRequest.text}`,
      action: {
        type: "setElementValue",
        text: setElementValueRequest.text,
        value: setElementValueRequest.value,
        controlType: setElementValueRequest.controlType,
        timeoutMs: setElementValueRequest.timeoutMs,
      },
      timeout: Math.max(10000, setElementValueRequest.timeoutMs + 2000),
    });
  }

  if (selectOptionRequest) {
    steps.push({
      id: "step_select_option",
      name: `Select ${selectOptionRequest.option}`,
      action: {
        type: "selectOption",
        option: selectOptionRequest.option,
        text: selectOptionRequest.text,
        controlType: selectOptionRequest.controlType,
      },
      timeout: 10000,
    });
  }

  if (setToggleStateRequest) {
    steps.push({
      id: "step_set_toggle_state",
      name: `${setToggleStateRequest.state === "toggle" ? "Toggle" : "Set"} ${setToggleStateRequest.text}`,
      action: {
        type: "setToggleState",
        text: setToggleStateRequest.text,
        state: setToggleStateRequest.state,
        controlType: setToggleStateRequest.controlType,
      },
      timeout: 10000,
    });
  }

  if (clickElementRequest) {
    steps.push({
      id: "step_click_element",
      name: `Click ${clickElementRequest.text}`,
      action: {
        type: "clickElement",
        text: clickElementRequest.text,
        ...(clickElementRequest.controlType
          ? { controlType: clickElementRequest.controlType }
          : {}),
        button: clickElementRequest.button,
        double: clickElementRequest.double,
      },
      timeout: 10000,
    });
  }

  if (url && /\b(open|launch|navigate|visit)\b/i.test(description)) {
    steps.push({
      id: "step_open_url",
      name: "Open URL",
      action: { type: "launchApp", appPath: url, wait: true },
      timeout: 10000,
    });
  }

  if (lower.includes("screenshot") || lower.includes("screen shot") || steps.length === 0) {
    steps.push({
      id: "step_screenshot_initial",
      name: "Capture screenshot",
      action: { type: "screenshot", analyze: false },
      timeout: 5000,
    });
  }

  if (waitMs !== null) {
    steps.push({
      id: "step_wait",
      name: "Wait",
      action: { type: "wait", ms: waitMs },
      timeout: waitMs + 2000,
    });

    if (lower.includes("screenshot") || lower.includes("screen shot")) {
      steps.push({
        id: "step_screenshot_final",
        name: "Capture final screenshot",
        action: { type: "screenshot", analyze: false },
        timeout: 5000,
      });
    }
  }

  return steps;
}

/**
 * Execute a predefined automation workflow.
 */
export function executeWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Prepare a predefined desktop workflow for Rearvy Desktop to execute after user approval.",
    parameters: {
      type: "object" as const,
      properties: {
        templateId: {
          type: "string",
          description: `ID of the predefined template. Choose from: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
        },
        config: {
          type: "object",
          description: "Configuration parameters for the template.",
          properties: {},
          additionalProperties: true,
        },
      },
      required: ["templateId", "config"],
    },
    execute: async (params: { templateId: string; config: Record<string, unknown> }) => {
      try {
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error: "Desktop automation requires the Rearvy desktop app.",
          };
        }

        const workflow = createWorkflowFromTemplate(params.templateId, ctx.userId, params.config);
        if (!workflow) {
          return {
            type: "error",
            error: `Template '${params.templateId}' not found. Available templates: ${WORKFLOW_TEMPLATES.map((t) => t.id).join(", ")}`,
          };
        }

        const payload = workflowFromTemplate(workflow, "template");

        return {
          type: "success",
          workflowId: payload.id,
          name: payload.name,
          status: "pending_approval",
          message: `Workflow "${payload.name}" is ready for desktop approval.`,
          steps: payload.steps.length,
          template: params.templateId,
          workflow: payload,
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Prepare a custom workflow from model-provided steps.
 */
export function planWorkflowTool(ctx: ToolContext) {
  return {
    description:
      "Prepare a custom desktop OS workflow for the Electron app. A single screenshot step can run immediately; every workflow that controls apps, files, shell, clipboard, windows, mouse, keyboard, browser, or other OS state must wait for user approval. Provide explicit safe steps using action types: screenshot, wait, launchApp, openPath, revealPath, readFile, readVisibleText, getElementState, getElementValue, invokeElement, listDirectory, listWindows, listUiElements, createDirectory, copyPath, movePath, trashPath, writeFile, appendToFile, replaceInFile, shellCommand, focusWindow, setWindowState, closeWindow, waitForElement, click, clickElement, typeIntoElement, setElementValue, selectOption, setToggleState, moveMouse, dragMouse, mouseDown, mouseUp, type, keyPress, setClipboard, getClipboard, scroll. Use readVisibleText when the user asks what text is visible on the app, page, screen, or current window. Use getElementState when the user asks whether a named control is enabled, checked, visible, focused, or what its state is. Use getElementValue when the user asks what value, text, or content is inside a named field. Use invokeElement when the user asks to press, activate, invoke, or trigger a named button, link, tab, menu item, or accessible command without requiring pointer coordinates. Use waitForElement before clicking, typing, or selecting when the app/page may still be loading. Use listWindows when the user asks which windows/apps are open. Use listUiElements to inspect visible buttons, fields, links, tabs, menus, and controls before deciding how to act. Use focusWindow before typing, clicking, or capturing evidence when the user names an app/window to work in. Use setWindowState with state minimize, maximize, or restore when the user asks to change a window view before work or screenshots. Use typeIntoElement when the user wants literal keyboard input into a named field. Use setElementValue when the user asks to set, fill, change, or update a named field to a value through accessibility APIs. Use selectOption when the user asks to choose an option from a dropdown, combo box, menu, or list. Use setToggleState when the user asks to check, uncheck, turn on/off, or toggle a named checkbox or switch. Use appendToFile for adding content to the end of an existing or new local file; it backs up existing files by default. Use replaceInFile for exact user-approved text edits in existing files; it backs up by default and only replaces all occurrences when requested. Use trashPath for user-approved file or folder cleanup; it moves the path to the OS trash/recycle bin rather than permanently deleting it. Use clickElement when the user names a visible UI label such as a button, link, field, tab, checkbox, menu item, or icon instead of giving coordinates. For createDirectory, copyPath, movePath, writeFile, appendToFile, and replaceInFile artifact/prototype steps, include revealAfterCreate, revealAfterCopy, revealAfterMove, revealAfterWrite, revealAfterAppend, or revealAfterReplace when the user should immediately see the affected item, and openAfterCreate, openAfterCopy, openAfterMove, openAfterWrite, openAfterAppend, or openAfterReplace only when opening it is clearly useful.",
    parameters: {
      type: "object" as const,
      properties: {
        description: {
          type: "string",
          description: "What the workflow should do.",
        },
        name: {
          type: "string",
          description: "Short workflow name.",
        },
        steps: {
          type: "array",
          description:
            "Executable desktop steps. If omitted, Rearvy will build a conservative screenshot/wait/open fallback workflow from the description.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              name: { type: "string" },
              description: { type: "string" },
              action: {
                ...ACTION_PARAMETER_SCHEMA,
              },
              timeout: { type: "number" },
              retry: {
                type: "object",
                properties: {
                  max: { type: "number" },
                  backoffMs: { type: "number" },
                },
              },
            },
            required: ["name", "action"],
          },
        },
      },
      required: ["description"],
    },
    execute: async (params: {
      description: string;
      name?: string;
      steps?: DesktopWorkflowStepInput[];
    }) => {
      try {
        if (!ctx.isDesktopApp) {
          return {
            type: "error",
            error: "Workflow planning requires the Rearvy desktop app.",
          };
        }

        const steps = Array.isArray(params.steps) && params.steps.length > 0
          ? params.steps
          : createFallbackSteps(params.description);

        const workflow = createWorkflowPayload({
          id: makeWorkflowId("chat_workflow"),
          name: params.name || "Desktop Workflow",
          description: params.description,
          source: "chat-tool",
          steps,
        });

        return {
          type: "success",
          workflowId: workflow.id,
          name: workflow.name,
          status: workflow.requiresApproval ? "pending_approval" : "ready",
          message: workflow.requiresApproval
            ? `Workflow "${workflow.name}" is ready for desktop approval.`
            : `Workflow "${workflow.name}" is ready to start automatically.`,
          steps: workflow.steps.length,
          requiresApproval: workflow.requiresApproval,
          workflow,
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * List available workflow templates.
 */
export function listWorkflowTemplatesTool(_ctx: ToolContext) {
  return {
    description: "List all available predefined automation workflow templates with descriptions and configuration schemas",
    parameters: {
      type: "object" as const,
      properties: {
        category: {
          type: "string",
          enum: ["trading", "communication", "files", "reporting", "automation", "all"],
          description:
            "Filter templates by category (trading, communication, files, reporting, automation, or all for no filter)",
        },
      },
    },
    execute: async (params: { category?: string }) => {
      try {
        const { category = "all" } = params;

        let templates = WORKFLOW_TEMPLATES;
        if (category !== "all" && category) {
          templates = templates.filter((template) => template.category === category);
        }

        return {
          type: "success",
          count: templates.length,
          templates: templates.map((template) => ({
            id: template.id,
            name: template.name,
            description: template.description,
            category: template.category,
            configSchema: template.configSchema,
          })),
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Get workflow execution status.
 */
export function getWorkflowStatusTool(_ctx: ToolContext) {
  return {
    description: "Check the status of a currently executing or recently completed desktop workflow",
    parameters: {
      type: "object" as const,
      properties: {
        workflowId: {
          type: "string",
          description: "ID of the workflow to check status for",
        },
      },
      required: ["workflowId"],
    },
    execute: async (params: { workflowId: string }) => {
      try {
        return {
          type: "success",
          workflowId: params.workflowId,
          message: "Workflow status is streamed in the Desktop Workspace side panel.",
        };
      } catch (error) {
        return {
          type: "error",
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  };
}

/**
 * Get desktop automation tools for tool registry.
 */
export async function getFLERBAITools(ctx: ToolContext) {
  return {
    executeWorkflow: executeWorkflowTool(ctx),
    planWorkflow: planWorkflowTool(ctx),
    listWorkflowTemplates: listWorkflowTemplatesTool(ctx),
    getWorkflowStatus: getWorkflowStatusTool(ctx),
  };
}
