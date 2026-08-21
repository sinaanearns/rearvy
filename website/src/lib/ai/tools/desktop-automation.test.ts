import assert from "node:assert/strict";
import test from "node:test";

import { planWorkflowTool } from "./desktop-automation";
import type { ToolContext } from "../types";

const ctx = {
  userId: "user_1",
  adminDb: {} as ToolContext["adminDb"],
  isDesktopApp: true,
} satisfies ToolContext;

function getExecute() {
  const tool = planWorkflowTool(ctx);
  assert.equal(typeof tool.execute, "function");
  return tool.execute;
}

function assertSuccessWorkflow(
  result: Awaited<ReturnType<ReturnType<typeof getExecute>>>
) {
  assert.equal(result.type, "success");
  assert.ok(result.workflow);
  return result.workflow;
}

test("planWorkflow exposes concrete desktop action schema fields", () => {
  const tool = planWorkflowTool(ctx);
  const steps = tool.parameters.properties.steps;
  const stepItems = "items" in steps ? steps.items : null;
  assert.ok(stepItems && typeof stepItems === "object");
  const action = stepItems.properties?.action;
  assert.ok(action && typeof action === "object");

  assert.ok(action.properties?.type);
  assert.ok(Array.isArray(action.properties.type.enum));
  assert.ok(action.properties.type.enum.includes("trashPath"));
  assert.ok(action.properties.type.enum.includes("appendToFile"));
  assert.ok(action.properties.type.enum.includes("replaceInFile"));
  assert.ok(action.properties.type.enum.includes("readVisibleText"));
  assert.ok(action.properties.type.enum.includes("getElementState"));
  assert.ok(action.properties.type.enum.includes("getElementValue"));
  assert.ok(action.properties.type.enum.includes("invokeElement"));
  assert.ok(action.properties.type.enum.includes("listWindows"));
  assert.ok(action.properties.type.enum.includes("listUiElements"));
  assert.ok(action.properties.type.enum.includes("setWindowState"));
  assert.ok(action.properties.type.enum.includes("typeIntoElement"));
  assert.ok(action.properties.type.enum.includes("setElementValue"));
  assert.ok(action.properties.type.enum.includes("selectOption"));
  assert.ok(action.properties.type.enum.includes("setToggleState"));
  assert.ok(action.properties.type.enum.includes("waitForElement"));
  assert.ok(action.properties?.path);
  assert.ok(action.properties?.filePath);
  assert.ok(action.properties?.directoryPath);
  assert.ok(action.properties?.sourcePath);
  assert.ok(action.properties?.destinationPath);
  assert.ok(action.properties?.content);
  assert.ok(action.properties?.append);
  assert.ok(action.properties?.value);
  assert.ok(action.properties?.option);
  assert.ok(action.properties?.optionText);
  assert.ok(action.properties?.selection);
  assert.ok(action.properties?.search);
  assert.ok(action.properties?.replacement);
  assert.ok(action.properties?.fromText);
  assert.ok(action.properties?.toText);
  assert.ok(action.properties?.replaceAll);
  assert.ok(action.properties?.command);
  assert.ok(action.properties?.windowTitle);
  assert.ok(action.properties?.title);
  assert.ok(action.properties?.state);
  assert.ok(action.properties?.windowState);
  assert.ok(action.properties?.x);
  assert.ok(action.properties?.y);
  assert.ok(action.properties?.fromX);
  assert.ok(action.properties?.toX);
  assert.ok(action.properties?.durationMs);
  assert.ok(action.properties?.steps);
  assert.ok(action.properties?.button);
  assert.ok(action.properties?.controlType);
  assert.ok(action.properties?.optionControlType);
  assert.ok(action.properties?.matchMode);
  assert.ok(action.properties?.clear);
  assert.ok(action.properties?.delayMs);
  assert.ok(action.properties?.timeoutMs);
  assert.ok(action.properties?.maxEntries);
  assert.ok(action.properties?.maxElements);
  assert.ok(action.properties?.maxTextItems);
  assert.ok(action.properties?.force);
  assert.ok(action.properties?.revealAfterWrite);
  assert.ok(action.properties?.revealAfterAppend);
  assert.ok(action.properties?.revealAfterReplace);
  assert.ok(action.properties?.appendNewline);
  assert.ok(action.properties?.openAfterCreate);
  assert.ok(action.properties?.openAfterCopy);
  assert.ok(action.properties?.openAfterMove);
  assert.ok(action.properties?.openAfterAppend);
  assert.ok(action.properties?.openAfterReplace);
});

test("planWorkflow accepts full desktop executor action surface", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Inspect a project file and run a harmless command.",
    name: "Desktop capability check",
    steps: [
      {
        name: "Reveal folder",
        action: { type: "revealPath", target: "C:\\Users\\Public" },
      },
      {
        name: "Read notes",
        action: { type: "readFile", path: "C:\\Users\\Public\\notes.txt" },
      },
      {
        name: "Write draft",
        action: {
          type: "writeFile",
          path: "C:\\Users\\Public\\draft.txt",
          content: "Draft",
        },
      },
      {
        name: "Append draft",
        action: {
          type: "appendToFile",
          path: "C:\\Users\\Public\\draft.txt",
          content: "Next note",
          backup: true,
          appendNewline: true,
          revealAfterAppend: true,
        },
      },
      {
        name: "Edit draft",
        action: {
          type: "replaceInFile",
          path: "C:\\Users\\Public\\draft.txt",
          search: "Draft",
          replacement: "Updated draft",
          backup: true,
          revealAfterReplace: true,
        },
      },
      {
        name: "Copy draft",
        action: {
          type: "copyPath",
          sourcePath: "C:\\Users\\Public\\draft.txt",
          destinationPath: "C:\\Users\\Public\\draft-copy.txt",
          revealAfterCopy: true,
        },
      },
      {
        name: "Move draft",
        action: {
          type: "movePath",
          sourcePath: "C:\\Users\\Public\\draft-copy.txt",
          destinationPath: "C:\\Users\\Public\\archive\\draft-copy.txt",
          revealAfterMove: true,
        },
      },
      {
        name: "Trash draft",
        action: {
          type: "trashPath",
          path: "C:\\Users\\Public\\archive\\old-draft.txt",
        },
      },
      {
        name: "Run command",
        action: { type: "shellCommand", command: "echo ready" },
      },
      {
        name: "List windows",
        action: { type: "listWindows" },
      },
      {
        name: "List buttons",
        action: { type: "listUiElements", controlType: "button", maxElements: 20 },
      },
      {
        name: "Read visible text",
        action: { type: "readVisibleText", maxTextItems: 120 },
      },
      {
        name: "Read submit state",
        action: { type: "getElementState", text: "Submit", controlType: "button", timeoutMs: 8000 },
      },
      {
        name: "Read email value",
        action: { type: "getElementValue", text: "Email", controlType: "edit", timeoutMs: 8000 },
      },
      {
        name: "Invoke submit",
        action: { type: "invokeElement", text: "Submit", controlType: "button", timeoutMs: 8000 },
      },
      {
        name: "Focus browser",
        action: { type: "focusWindow", windowTitle: "Chrome" },
      },
      {
        name: "Maximize browser",
        action: { type: "setWindowState", state: "maximize", windowTitle: "Chrome" },
      },
      {
        name: "List folder",
        action: { type: "listDirectory", path: "C:\\Users\\Public", maxEntries: 10 },
      },
      {
        name: "Click point",
        action: { type: "click", x: 20, y: 30, button: "left" },
      },
      {
        name: "Click login",
        action: { type: "clickElement", text: "Login", controlType: "button" },
      },
      {
        name: "Wait for email",
        action: { type: "waitForElement", text: "Email", controlType: "edit", timeoutMs: 15000 },
      },
      {
        name: "Type email",
        action: {
          type: "typeIntoElement",
          text: "Email",
          value: "test@example.com",
          controlType: "edit",
        },
      },
      {
        name: "Set email",
        action: {
          type: "setElementValue",
          text: "Email",
          value: "test@example.com",
          controlType: "edit",
        },
      },
      {
        name: "Select plan",
        action: {
          type: "selectOption",
          text: "Plan",
          option: "Pro",
          controlType: "combobox",
        },
      },
      {
        name: "Check remember me",
        action: {
          type: "setToggleState",
          text: "Remember me",
          state: "checked",
          controlType: "checkbox",
        },
      },
      {
        name: "Drag point",
        action: {
          type: "dragMouse",
          fromX: 20,
          fromY: 30,
          toX: 60,
          toY: 80,
          durationMs: 400,
          steps: 12,
        },
      },
      {
        name: "Hold mouse",
        action: { type: "mouseDown", button: "right" },
      },
      {
        name: "Release mouse",
        action: { type: "mouseUp", button: "right" },
      },
      {
        name: "Type text",
        action: { type: "type", text: "hello", delayMs: 10 },
      },
      {
        name: "Press key",
        action: { type: "keyPress", key: "Control+v", modifiers: ["Control"] },
      },
      {
        name: "Set clipboard",
        action: { type: "setClipboard", text: "hello" },
      },
      {
        name: "Read clipboard",
        action: { type: "getClipboard" },
      },
      {
        name: "Scroll",
        action: { type: "scroll", direction: "down", amount: 500 },
      },
      {
        name: "Close window",
        action: { type: "closeWindow", force: true },
      },
    ],
  });

  assert.equal(result.type, "success");
  assert.equal(result.steps, 34);
  assert.equal(result.workflow.steps[0]?.action.type, "revealPath");
  assert.equal(result.workflow.steps[1]?.action.type, "readFile");
  assert.equal(result.workflow.steps[2]?.action.type, "writeFile");
  assert.equal(result.workflow.steps[3]?.action.type, "appendToFile");
  assert.equal(result.workflow.steps[4]?.action.type, "replaceInFile");
  assert.equal(result.workflow.steps[5]?.action.type, "copyPath");
  assert.equal(result.workflow.steps[6]?.action.type, "movePath");
  assert.equal(result.workflow.steps[7]?.action.type, "trashPath");
  assert.equal(result.workflow.steps[8]?.action.type, "shellCommand");
  assert.equal(result.workflow.steps[9]?.action.type, "listWindows");
  assert.equal(result.workflow.steps[10]?.action.type, "listUiElements");
  assert.equal(result.workflow.steps[11]?.action.type, "readVisibleText");
  assert.equal(result.workflow.steps[12]?.action.type, "getElementState");
  assert.equal(result.workflow.steps[13]?.action.type, "getElementValue");
  assert.equal(result.workflow.steps[14]?.action.type, "invokeElement");
  assert.equal(result.workflow.steps[15]?.action.type, "focusWindow");
  assert.equal(result.workflow.steps[16]?.action.type, "setWindowState");
  assert.equal(result.workflow.steps[17]?.action.type, "listDirectory");
  assert.equal(result.workflow.steps[18]?.action.type, "click");
  assert.equal(result.workflow.steps[19]?.action.type, "clickElement");
  assert.equal(result.workflow.steps[20]?.action.type, "waitForElement");
  assert.equal(result.workflow.steps[21]?.action.type, "typeIntoElement");
  assert.equal(result.workflow.steps[22]?.action.type, "setElementValue");
  assert.equal(result.workflow.steps[23]?.action.type, "selectOption");
  assert.equal(result.workflow.steps[24]?.action.type, "setToggleState");
  assert.equal(result.workflow.steps[25]?.action.type, "dragMouse");
  assert.equal(result.workflow.steps[26]?.action.type, "mouseDown");
  assert.equal(result.workflow.steps[27]?.action.type, "mouseUp");
  assert.equal(result.workflow.steps[28]?.action.type, "type");
  assert.equal(result.workflow.steps[29]?.action.type, "keyPress");
  assert.equal(result.workflow.steps[30]?.action.type, "setClipboard");
  assert.equal(result.workflow.steps[31]?.action.type, "getClipboard");
  assert.equal(result.workflow.steps[32]?.action.type, "scroll");
  assert.equal(result.workflow.steps[33]?.action.type, "closeWindow");
});

test("planWorkflow lets a single screenshot workflow run without approval", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Capture a desktop screenshot",
    name: "Capture screenshot",
    steps: [
      {
        name: "Capture screenshot",
        action: { type: "screenshot", analyze: false },
      },
    ],
  });
  const workflow = assertSuccessWorkflow(result);

  assert.equal(workflow.requiresApproval, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.status, "ready");
});

test("planWorkflow keeps mixed desktop workflows approval-gated", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Capture a screenshot after opening Chrome",
    name: "Open Chrome and capture screenshot",
    steps: [
      {
        name: "Open Chrome",
        action: { type: "launchApp", appPath: "chrome", wait: true },
      },
      {
        name: "Capture screenshot",
        action: { type: "screenshot", analyze: false },
      },
    ],
  });
  const workflow = assertSuccessWorkflow(result);

  assert.equal(workflow.requiresApproval, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.status, "pending_approval");
});

test("planWorkflow fallback infers named UI element clicks", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Click the Login button",
  });
  const workflow = assertSuccessWorkflow(result);
  const clickStep = workflow.steps.find((step) => step.action.type === "clickElement");

  assert.equal(clickStep?.action.type, "clickElement");
  assert.equal(clickStep?.action.text, "Login");
  assert.equal(clickStep?.action.controlType, "button");
  assert.equal(clickStep?.action.button, "left");
});

test("planWorkflow fallback infers wait-for-element steps", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Wait for the Login button",
  });
  const workflow = assertSuccessWorkflow(result);
  const waitStep = workflow.steps.find((step) => step.action.type === "waitForElement");

  assert.equal(waitStep?.action.type, "waitForElement");
  assert.equal(waitStep?.action.text, "Login");
  assert.equal(waitStep?.action.controlType, "button");
  assert.equal(waitStep?.action.timeoutMs, 15000);
});

test("planWorkflow fallback infers visible text reading", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Read visible text from the current screen",
  });
  const workflow = assertSuccessWorkflow(result);

  assert.equal(workflow.steps[0]?.action.type, "readVisibleText");
  assert.equal(workflow.steps[0]?.action.maxTextItems, 120);
});

test("planWorkflow fallback infers element state inspection", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Is the Remember me checkbox checked",
  });
  const workflow = assertSuccessWorkflow(result);
  const stateStep = workflow.steps.find((step) => step.action.type === "getElementState");

  assert.equal(stateStep?.action.type, "getElementState");
  assert.equal(stateStep?.action.text, "Remember me");
  assert.equal(stateStep?.action.controlType, "checkbox");
  assert.equal(stateStep?.action.timeoutMs, 8000);
});

test("planWorkflow fallback infers field value reading", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Read the value of the Email field",
  });
  const workflow = assertSuccessWorkflow(result);
  const valueStep = workflow.steps.find((step) => step.action.type === "getElementValue");

  assert.equal(valueStep?.action.type, "getElementValue");
  assert.equal(valueStep?.action.text, "Email");
  assert.equal(valueStep?.action.controlType, "edit");
  assert.equal(valueStep?.action.timeoutMs, 8000);
});

test("planWorkflow fallback infers element invocation", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Press the Login button",
  });
  const workflow = assertSuccessWorkflow(result);
  const invokeStep = workflow.steps.find((step) => step.action.type === "invokeElement");

  assert.equal(invokeStep?.action.type, "invokeElement");
  assert.equal(invokeStep?.action.text, "Login");
  assert.equal(invokeStep?.action.controlType, "button");
  assert.equal(invokeStep?.action.timeoutMs, 8000);
});

test("planWorkflow fallback infers named field input", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Enter \"test@example.com\" into the Email field",
  });
  const workflow = assertSuccessWorkflow(result);
  const inputStep = workflow.steps.find((step) => step.action.type === "typeIntoElement");

  assert.equal(inputStep?.action.type, "typeIntoElement");
  assert.equal(inputStep?.action.text, "Email");
  assert.equal(inputStep?.action.value, "test@example.com");
  assert.equal(inputStep?.action.controlType, "edit");
});

test("planWorkflow fallback infers direct field value setting", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Set the Email field to test@example.com",
  });
  const workflow = assertSuccessWorkflow(result);
  const valueStep = workflow.steps.find((step) => step.action.type === "setElementValue");

  assert.equal(valueStep?.action.type, "setElementValue");
  assert.equal(valueStep?.action.text, "Email");
  assert.equal(valueStep?.action.value, "test@example.com");
  assert.equal(valueStep?.action.controlType, "edit");
  assert.equal(valueStep?.action.timeoutMs, 8000);
});

test("planWorkflow fallback infers option selection", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Select \"Pro\" from the Plan dropdown",
  });
  const workflow = assertSuccessWorkflow(result);
  const selectStep = workflow.steps.find((step) => step.action.type === "selectOption");

  assert.equal(selectStep?.action.type, "selectOption");
  assert.equal(selectStep?.action.option, "Pro");
  assert.equal(selectStep?.action.text, "Plan");
  assert.equal(selectStep?.action.controlType, "combobox");
});

test("planWorkflow fallback infers toggle state changes", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Uncheck the Subscribe checkbox",
  });
  const workflow = assertSuccessWorkflow(result);
  const toggleStep = workflow.steps.find((step) => step.action.type === "setToggleState");

  assert.equal(toggleStep?.action.type, "setToggleState");
  assert.equal(toggleStep?.action.text, "Subscribe");
  assert.equal(toggleStep?.action.state, "unchecked");
  assert.equal(toggleStep?.action.controlType, "checkbox");
});

test("planWorkflow fallback infers focus-window steps", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Switch to the Chrome window before taking a screenshot",
  });
  const workflow = assertSuccessWorkflow(result);
  const focusStep = workflow.steps.find((step) => step.action.type === "focusWindow");

  assert.equal(focusStep?.action.type, "focusWindow");
  assert.equal(focusStep?.action.windowTitle, "Chrome");
});

test("planWorkflow fallback infers list-window steps", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Show open windows",
  });
  const workflow = assertSuccessWorkflow(result);

  assert.equal(workflow.steps[0]?.action.type, "listWindows");
});

test("planWorkflow fallback infers UI element listing steps", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "List visible fields",
  });
  const workflow = assertSuccessWorkflow(result);

  assert.equal(workflow.steps[0]?.action.type, "listUiElements");
  assert.equal(workflow.steps[0]?.action.controlType, "edit");
});

test("planWorkflow fallback infers window-state steps", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Maximize the Chrome window before taking a screenshot",
  });
  const workflow = assertSuccessWorkflow(result);
  const stateStep = workflow.steps.find((step) => step.action.type === "setWindowState");

  assert.equal(stateStep?.action.type, "setWindowState");
  assert.equal(stateStep?.action.state, "maximize");
  assert.equal(stateStep?.action.windowTitle, "Chrome");
});

test("planWorkflow fallback infers file and folder desktop steps", async () => {
  const execute = getExecute();
  const readResult = await execute({
    description: "Read the file \"C:\\Users\\Public\\notes.txt\"",
  });
  const listResult = await execute({
    description: "List the folder \"C:\\Users\\Public\"",
  });
  const createFolderResult = await execute({
    description: "Create folder \"C:\\Users\\Public\\Rearvy Evidence\" and open it",
  });
  const copyPathResult = await execute({
    description:
      "Copy file \"C:\\Users\\Public\\notes.txt\" to \"C:\\Users\\Public\\notes-copy.txt\" and open it",
  });
  const movePathResult = await execute({
    description:
      "Rename file \"C:\\Users\\Public\\notes-copy.txt\" to \"C:\\Users\\Public\\notes-renamed.txt\" and open it",
  });
  const trashPathResult = await execute({
    description:
      "Delete file \"C:\\Users\\Public\\old-notes.txt\"",
  });
  const recycleBinResult = await execute({
    description:
      "Move file \"C:\\Users\\Public\\old-folder\" to recycle bin",
  });
  const revealResult = await execute({
    description: "Reveal \"C:\\Users\\Public\\notes.txt\"",
  });

  const readWorkflow = assertSuccessWorkflow(readResult);
  const listWorkflow = assertSuccessWorkflow(listResult);
  const createFolderWorkflow = assertSuccessWorkflow(createFolderResult);
  const copyPathWorkflow = assertSuccessWorkflow(copyPathResult);
  const movePathWorkflow = assertSuccessWorkflow(movePathResult);
  const trashPathWorkflow = assertSuccessWorkflow(trashPathResult);
  const recycleBinWorkflow = assertSuccessWorkflow(recycleBinResult);
  const revealWorkflow = assertSuccessWorkflow(revealResult);

  assert.equal(readWorkflow.steps[0]?.action.type, "readFile");
  assert.equal(readWorkflow.steps[0]?.action.path, "C:\\Users\\Public\\notes.txt");
  assert.equal(listWorkflow.steps[0]?.action.type, "listDirectory");
  assert.equal(createFolderWorkflow.steps[0]?.action.type, "createDirectory");
  assert.equal(
    createFolderWorkflow.steps[0]?.action.path,
    "C:\\Users\\Public\\Rearvy Evidence"
  );
  assert.equal(createFolderWorkflow.steps[0]?.action.revealAfterCreate, true);
  assert.equal(createFolderWorkflow.steps[0]?.action.openAfterCreate, true);
  assert.equal(copyPathWorkflow.steps[0]?.action.type, "copyPath");
  assert.equal(copyPathWorkflow.steps[0]?.action.sourcePath, "C:\\Users\\Public\\notes.txt");
  assert.equal(copyPathWorkflow.steps[0]?.action.destinationPath, "C:\\Users\\Public\\notes-copy.txt");
  assert.equal(copyPathWorkflow.steps[0]?.action.revealAfterCopy, true);
  assert.equal(copyPathWorkflow.steps[0]?.action.openAfterCopy, true);
  assert.equal(copyPathWorkflow.steps[0]?.action.overwrite, false);
  assert.equal(movePathWorkflow.steps[0]?.action.type, "movePath");
  assert.equal(movePathWorkflow.steps[0]?.action.sourcePath, "C:\\Users\\Public\\notes-copy.txt");
  assert.equal(movePathWorkflow.steps[0]?.action.destinationPath, "C:\\Users\\Public\\notes-renamed.txt");
  assert.equal(movePathWorkflow.steps[0]?.action.revealAfterMove, true);
  assert.equal(movePathWorkflow.steps[0]?.action.openAfterMove, true);
  assert.equal(trashPathWorkflow.steps[0]?.action.type, "trashPath");
  assert.equal(trashPathWorkflow.steps[0]?.action.path, "C:\\Users\\Public\\old-notes.txt");
  assert.equal(recycleBinWorkflow.steps[0]?.action.type, "trashPath");
  assert.equal(recycleBinWorkflow.steps[0]?.action.path, "C:\\Users\\Public\\old-folder");
  assert.equal(revealWorkflow.steps[0]?.action.type, "revealPath");
});

test("planWorkflow fallback infers explicit shell commands", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Run command: echo ready",
  });
  const naturalResult = await execute({
    description: "Run npm run build",
  });
  const terminalResult = await execute({
    description: "Open terminal and run git status",
  });

  const workflow = assertSuccessWorkflow(result);
  const naturalWorkflow = assertSuccessWorkflow(naturalResult);
  const terminalWorkflow = assertSuccessWorkflow(terminalResult);

  assert.equal(workflow.steps[0]?.action.type, "shellCommand");
  assert.equal(workflow.steps[0]?.action.command, "echo ready");
  assert.equal(naturalWorkflow.steps[0]?.action.type, "shellCommand");
  assert.equal(naturalWorkflow.steps[0]?.action.command, "npm run build");
  assert.equal(terminalWorkflow.steps[0]?.action.type, "shellCommand");
  assert.equal(terminalWorkflow.steps[0]?.action.command, "git status");
});

test("planWorkflow fallback infers explicit write file requests", async () => {
  const execute = getExecute();
  const result = await execute({
    description:
      "Create file \"C:\\Users\\Public\\clicky-note.txt\" with content: Clicky evidence draft",
  });
  const openAfterWriteResult = await execute({
    description:
      "Create file \"C:\\Users\\Public\\clicky-open-note.txt\" with content: Clicky evidence draft and open it",
  });
  const contentFirstResult = await execute({
    description:
      "Write \"hello world\" to file \"C:\\Users\\Public\\hello.txt\" and open it",
  });
  const missingContentResult = await execute({
    description: "Create file \"C:\\Users\\Public\\clicky-note.txt\"",
  });

  const workflow = assertSuccessWorkflow(result);
  const openAfterWriteWorkflow = assertSuccessWorkflow(openAfterWriteResult);
  const contentFirstWorkflow = assertSuccessWorkflow(contentFirstResult);
  const missingContentWorkflow = assertSuccessWorkflow(missingContentResult);

  assert.equal(workflow.steps[0]?.action.type, "writeFile");
  assert.equal(workflow.steps[0]?.action.path, "C:\\Users\\Public\\clicky-note.txt");
  assert.equal(workflow.steps[0]?.action.content, "Clicky evidence draft");
  assert.equal(workflow.steps[0]?.action.revealAfterWrite, true);
  assert.equal(workflow.steps[0]?.action.openAfterWrite, false);
  assert.equal(openAfterWriteWorkflow.steps[0]?.action.type, "writeFile");
  assert.equal(openAfterWriteWorkflow.steps[0]?.action.openAfterWrite, true);
  assert.equal(openAfterWriteWorkflow.steps[0]?.action.content, "Clicky evidence draft");
  assert.equal(contentFirstWorkflow.steps[0]?.action.type, "writeFile");
  assert.equal(contentFirstWorkflow.steps[0]?.action.path, "C:\\Users\\Public\\hello.txt");
  assert.equal(contentFirstWorkflow.steps[0]?.action.content, "hello world");
  assert.equal(contentFirstWorkflow.steps[0]?.action.openAfterWrite, true);
  assert.notEqual(missingContentWorkflow.steps[0]?.action.type, "writeFile");
});

test("planWorkflow fallback infers append file requests", async () => {
  const execute = getExecute();
  const appendResult = await execute({
    description:
      "Append \"next line\" to file \"C:\\Users\\Public\\clicky-note.txt\" and open it",
  });
  const addLineResult = await execute({
    description:
      "Add line todo item to file C:\\Users\\Public\\clicky-todos.txt",
  });

  const workflow = assertSuccessWorkflow(appendResult);
  const addLineWorkflow = assertSuccessWorkflow(addLineResult);

  assert.equal(workflow.steps[0]?.action.type, "appendToFile");
  assert.equal(workflow.steps[0]?.action.path, "C:\\Users\\Public\\clicky-note.txt");
  assert.equal(workflow.steps[0]?.action.content, "next line");
  assert.equal(workflow.steps[0]?.action.backup, true);
  assert.equal(workflow.steps[0]?.action.appendNewline, true);
  assert.equal(workflow.steps[0]?.action.revealAfterAppend, true);
  assert.equal(workflow.steps[0]?.action.openAfterAppend, true);
  assert.equal(addLineWorkflow.steps[0]?.action.type, "appendToFile");
  assert.equal(addLineWorkflow.steps[0]?.action.path, "C:\\Users\\Public\\clicky-todos.txt");
  assert.equal(addLineWorkflow.steps[0]?.action.content, "todo item");
  assert.equal(addLineWorkflow.steps[0]?.action.openAfterAppend, false);
});

test("planWorkflow fallback infers exact text replacements in files", async () => {
  const execute = getExecute();
  const replaceResult = await execute({
    description:
      "Replace \"Draft\" with \"Published\" in file \"C:\\Users\\Public\\clicky-note.txt\" and open it",
  });
  const replaceAllResult = await execute({
    description:
      "In file \"C:\\Users\\Public\\clicky-note.txt\", replace all \"todo\" with \"done\"",
  });

  const workflow = assertSuccessWorkflow(replaceResult);
  const replaceAllWorkflow = assertSuccessWorkflow(replaceAllResult);

  assert.equal(workflow.steps[0]?.action.type, "replaceInFile");
  assert.equal(workflow.steps[0]?.action.path, "C:\\Users\\Public\\clicky-note.txt");
  assert.equal(workflow.steps[0]?.action.search, "Draft");
  assert.equal(workflow.steps[0]?.action.replacement, "Published");
  assert.equal(workflow.steps[0]?.action.replaceAll, false);
  assert.equal(workflow.steps[0]?.action.backup, true);
  assert.equal(workflow.steps[0]?.action.revealAfterReplace, true);
  assert.equal(workflow.steps[0]?.action.openAfterReplace, true);
  assert.equal(replaceAllWorkflow.steps[0]?.action.type, "replaceInFile");
  assert.equal(replaceAllWorkflow.steps[0]?.action.search, "todo");
  assert.equal(replaceAllWorkflow.steps[0]?.action.replacement, "done");
  assert.equal(replaceAllWorkflow.steps[0]?.action.replaceAll, true);
});

test("planWorkflow preserves write file artifact visibility flags", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Create a prototype artifact and reveal it.",
    steps: [
      {
        name: "Write PRD",
        action: {
          type: "writeFile",
          path: "C:\\Users\\Public\\clicky\\prd.md",
          content: "# PRD",
          backup: true,
          revealAfterWrite: true,
          openAfterWrite: false,
        },
      },
    ],
  });

  const workflow = assertSuccessWorkflow(result);
  const action = workflow.steps[0]?.action;
  assert.equal(action.type, "writeFile");
  assert.equal(action.backup, true);
  assert.equal(action.revealAfterWrite, true);
  assert.equal(action.openAfterWrite, false);
});

test("planWorkflow still blocks unsupported or dangerous desktop actions", async () => {
  const execute = getExecute();
  const unsupported = await execute({
    description: "Unsupported action",
    steps: [{ name: "Bad", action: { type: "installKernelDriver" } }],
  });
  const destructive = await execute({
    description: "Dangerous action",
    steps: [{ name: "Bad", action: { type: "shellCommand", command: "shutdown /s" } }],
  });

  assert.equal(unsupported.type, "error");
  const unsupportedError = typeof unsupported.error === "string" ? unsupported.error : "";
  assert.match(unsupportedError, /Unsupported desktop action type/);
  assert.equal(destructive.type, "error");
  const destructiveError = typeof destructive.error === "string" ? destructive.error : "";
  assert.match(destructiveError, /potentially destructive/);
});

test("planWorkflow blocks destructive shell commands and protected writes", async () => {
  const execute = getExecute();
  const dangerousCases = [
    { type: "shellCommand", command: "rm -rf C:\\Users\\Public\\demo" },
    { type: "shellCommand", command: "del C:\\Users\\Public\\demo.txt" },
    { type: "shellCommand", command: "taskkill /IM chrome.exe /F" },
    { type: "shellCommand", command: "reg delete HKCU\\Software\\Rearvy /f" },
    {
      type: "writeFile",
      path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
      content: "127.0.0.1 example.com",
    },
    {
      type: "appendToFile",
      path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
      content: "127.0.0.1 example.com",
    },
    {
      type: "replaceInFile",
      path: "C:\\Windows\\System32\\drivers\\etc\\hosts",
      search: "example.com",
      replacement: "example.org",
    },
    {
      type: "createDirectory",
      path: "C:\\Windows\\System32\\rearvy-test",
    },
    {
      type: "copyPath",
      sourcePath: "C:\\Users\\Public\\demo.txt",
      destinationPath: "C:\\Windows\\System32\\demo.txt",
    },
    {
      type: "movePath",
      sourcePath: "C:\\Windows\\System32\\demo.txt",
      destinationPath: "C:\\Users\\Public\\demo.txt",
    },
    {
      type: "movePath",
      sourcePath: "C:\\Users\\Public\\demo.txt",
      destinationPath: "C:\\Windows\\System32\\demo.txt",
    },
    {
      type: "trashPath",
      path: "C:\\Windows\\System32\\demo.txt",
    },
    {
      type: "trashPath",
      sourcePath: "C:\\Windows\\System32\\demo.txt",
    },
    {
      type: "shellCommand",
      command: "Set-Content C:\\Windows\\Temp\\rearvy.txt ready",
    },
  ];

  for (const action of dangerousCases) {
    const result = await execute({
      description: "Dangerous desktop action",
      steps: [{ name: "Bad", action }],
    });

    assert.equal(result.type, "error", JSON.stringify(action));
    const error = typeof result.error === "string" ? result.error : "";
    assert.match(error, /potentially destructive/);
  }
});

test("planWorkflow allows harmless shell commands and read-only protected path access", async () => {
  const execute = getExecute();
  const result = await execute({
    description: "Read a protected Windows file and print a status message.",
    steps: [
      { name: "Read system file", action: { type: "readFile", path: "C:\\Windows\\win.ini" } },
      { name: "Echo status", action: { type: "shellCommand", command: "echo remove button label" } },
    ],
  });

  const workflow = assertSuccessWorkflow(result);
  assert.equal(workflow.steps[0]?.action.type, "readFile");
  assert.equal(workflow.steps[1]?.action.type, "shellCommand");
});
