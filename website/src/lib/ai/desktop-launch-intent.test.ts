import test from "node:test";
import assert from "node:assert/strict";

import {
  buildClickyDesktopOperatorWorkflow,
  buildDirectDesktopWorkflow,
  buildDesktopLaunchIntentFromTarget,
  buildDesktopLaunchWorkflow,
  detectDesktopLaunchFollowUpIntent,
  detectDesktopLaunchIntent,
  hasClickyDesktopOperatorIntent,
  hasDirectDesktopWorkflowIntent,
  isDesktopLaunchRepeatRequest,
} from "./desktop-launch-intent";

test("detects default browser launch requests", () => {
  const intent = detectDesktopLaunchIntent("i want you to open browser");

  assert.equal(intent?.kind, "browser");
  assert.equal(intent?.label, "default browser");
  assert.deepEqual(intent?.action, {
    type: "openPath",
    target: "https://www.google.com",
    wait: true,
  });
});

test("detects named browser and app launch requests", () => {
  const chrome = detectDesktopLaunchIntent("open Chrome");
  const spotify = detectDesktopLaunchIntent("launch Spotify app");
  const photoshop = detectDesktopLaunchIntent("open Photoshop from desktop");
  const accio = detectDesktopLaunchIntent("open Accio in my desktop");
  const antigravity = detectDesktopLaunchIntent("open antigravity desktop app");
  const misspelledAntigravity = detectDesktopLaunchIntent("open atigravity");
  const quotedChrome = detectDesktopLaunchIntent("open \u2018Chrome\u2019");

  assert.equal(chrome?.kind, "browser");
  assert.equal(quotedChrome?.kind, "browser");
  assert.deepEqual(chrome?.action, {
    type: "launchApp",
    appPath: "chrome.exe",
    wait: true,
  });

  assert.equal(spotify?.kind, "app");
  assert.deepEqual(spotify?.action, {
    type: "launchApp",
    appPath: "Spotify",
    wait: true,
  });

  assert.equal(photoshop?.kind, "app");
  assert.deepEqual(photoshop?.action, {
    type: "launchApp",
    appPath: "Photoshop",
    wait: true,
  });

  assert.equal(accio?.kind, "app");
  assert.equal(accio?.label, "Accio");
  assert.deepEqual(accio?.action, {
    type: "launchApp",
    appPath: "Accio",
    wait: true,
  });

  assert.equal(antigravity?.kind, "app");
  assert.deepEqual(antigravity?.action, {
    type: "launchApp",
    appPath: "Antigravity",
    wait: true,
  });

  assert.equal(misspelledAntigravity?.kind, "app");
  assert.deepEqual(misspelledAntigravity?.action, {
    type: "launchApp",
    appPath: "Antigravity",
    wait: true,
  });
});

test("builds approval workflow payload for desktop launch intent", () => {
  const intent = detectDesktopLaunchIntent("open notepad");
  assert.ok(intent);

  const workflow = buildDesktopLaunchWorkflow(intent);

  assert.equal(workflow.name, "Open Notepad");
  assert.equal(workflow.steps.length, 1);
  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.equal(workflow.steps[0]?.timeout, 20000);
});

test("does not treat arbitrary open requests as app launches", () => {
  assert.equal(detectDesktopLaunchIntent("open the latest sales report"), null);
  assert.equal(detectDesktopLaunchIntent("run terminal command: dir"), null);
});

test("detects app-name follow-up after a launch request", () => {
  const intent = detectDesktopLaunchFollowUpIntent(
    "open Accio in my desktop",
    "Accio app"
  );

  assert.equal(intent?.kind, "app");
  assert.equal(intent?.label, "Accio");
  assert.deepEqual(intent?.action, {
    type: "launchApp",
    appPath: "Accio",
    wait: true,
  });

  assert.equal(
    detectDesktopLaunchFollowUpIntent("what is Accio?", "Accio app"),
    null
  );
});

test("detects repeat launch requests without treating again as a target", () => {
  assert.equal(isDesktopLaunchRepeatRequest("open again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("open it again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("launch the same again"), true);
  assert.equal(isDesktopLaunchRepeatRequest("open Gmail"), false);

  const intent = buildDesktopLaunchIntentFromTarget("Lenovo Vantage");
  assert.equal(intent?.kind, "app");
  assert.equal(intent?.label, "Lenovo Vantage");
  assert.deepEqual(intent?.action, {
    type: "launchApp",
    appPath: "Lenovo Vantage",
    wait: true,
  });
});

test("detects Clicky desktop operator requests", () => {
  assert.equal(
    hasClickyDesktopOperatorIntent("Clicky open Notepad app, work on that app, screenshot it and show me"),
    true
  );
  assert.equal(
    hasClickyDesktopOperatorIntent("Clicky go on competitors page and find screenshots"),
    false
  );
  assert.equal(
    hasClickyDesktopOperatorIntent("take a screenshot of the current app"),
    true
  );
  assert.equal(
    hasClickyDesktopOperatorIntent("Clicky fix it"),
    true
  );
});

test("builds Clicky desktop operator workflows with launch and evidence steps", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, work on that app, screenshot it and show me"
  );

  assert.equal(workflow.name, "Clicky operate Notepad");
  assert.match(workflow.description, /Do not type secrets/);
  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.equal(workflow.steps[0]?.name, "Open Notepad");
  assert.equal(workflow.steps.some((step) => step.action.type === "screenshot"), true);
  assert.equal(workflow.steps.at(-1)?.name, "Capture final screen");
});

test("builds Clicky desktop workflows with app typing and key presses", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, type \"hello from Clicky\", press Enter, screenshot it and show me"
  );
  const typeStep = workflow.steps.find((step) => step.id === "step_type_text");
  const keyStep = workflow.steps.find((step) => step.id === "step_key_press");

  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.equal(typeStep?.action.type, "type");
  assert.equal(
    typeStep?.action.type === "type" ? typeStep.action.text : null,
    "hello from Clicky"
  );
  assert.equal(keyStep?.action.type, "keyPress");
  assert.equal(
    keyStep?.action.type === "keyPress" ? keyStep.action.key : null,
    "Enter"
  );
  assert.equal(workflow.steps.at(-1)?.action.type, "screenshot");
});

test("builds Clicky desktop workflows with explicit mouse and scroll actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Paint app, move mouse to 120,240, double click at 180,260, click the Save button, scroll down 500, screenshot it"
  );
  const moveStep = workflow.steps.find((step) => step.id === "step_move_mouse");
  const clickStep = workflow.steps.find((step) => step.id === "step_click");
  const clickElementStep = workflow.steps.find((step) => step.id === "step_click_element");
  const scrollStep = workflow.steps.find((step) => step.id === "step_scroll");

  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.equal(moveStep?.action.type, "moveMouse");
  assert.equal(
    moveStep?.action.type === "moveMouse" ? moveStep.action.x : null,
    120
  );
  assert.equal(
    moveStep?.action.type === "moveMouse" ? moveStep.action.y : null,
    240
  );
  assert.equal(clickStep?.action.type, "click");
  assert.equal(clickStep?.action.type === "click" ? clickStep.action.x : null, 180);
  assert.equal(clickStep?.action.type === "click" ? clickStep.action.y : null, 260);
  assert.equal(clickStep?.action.type === "click" ? clickStep.action.double : null, true);
  assert.equal(clickElementStep?.action.type, "clickElement");
  assert.equal(
    clickElementStep?.action.type === "clickElement" ? clickElementStep.action.text : null,
    "Save"
  );
  assert.equal(
    clickElementStep?.action.type === "clickElement" ? clickElementStep.action.controlType : null,
    "button"
  );
  assert.equal(scrollStep?.action.type, "scroll");
  assert.equal(
    scrollStep?.action.type === "scroll" ? scrollStep.action.direction : null,
    "down"
  );
  assert.equal(scrollStep?.action.type === "scroll" ? scrollStep.action.amount : null, 500);
});

test("builds Clicky desktop workflows with named field input", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky enter \"test@example.com\" into the Email field, click the Continue button, screenshot it"
  );
  const valueWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky set the Email field to test@example.com"
  );
  const typeIntoStep = workflow.steps.find((step) => step.id === "step_type_into_element");
  const valueStep = valueWorkflow.steps.find((step) => step.id === "step_set_element_value");

  assert.equal(typeIntoStep?.action.type, "typeIntoElement");
  assert.equal(
    typeIntoStep?.action.type === "typeIntoElement" ? typeIntoStep.action.text : null,
    "Email"
  );
  assert.equal(
    typeIntoStep?.action.type === "typeIntoElement" ? typeIntoStep.action.value : null,
    "test@example.com"
  );
  assert.equal(
    typeIntoStep?.action.type === "typeIntoElement" ? typeIntoStep.action.controlType : null,
    "edit"
  );
  assert.equal(valueStep?.action.type, "setElementValue");
  assert.equal(
    valueStep?.action.type === "setElementValue" ? valueStep.action.text : null,
    "Email"
  );
  assert.equal(
    valueStep?.action.type === "setElementValue" ? valueStep.action.value : null,
    "test@example.com"
  );
});

test("builds Clicky desktop workflows with option selection", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky select \"Pro\" from the Plan dropdown, screenshot it"
  );
  const selectStep = workflow.steps.find((step) => step.id === "step_select_option");

  assert.equal(selectStep?.action.type, "selectOption");
  assert.equal(
    selectStep?.action.type === "selectOption" ? selectStep.action.option : null,
    "Pro"
  );
  assert.equal(
    selectStep?.action.type === "selectOption" ? selectStep.action.text : null,
    "Plan"
  );
  assert.equal(
    selectStep?.action.type === "selectOption" ? selectStep.action.controlType : null,
    "combobox"
  );
});

test("builds Clicky desktop workflows with toggle actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky check the Remember me checkbox, screenshot it"
  );
  const offWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky turn off Marketing emails switch"
  );
  const toggleStep = workflow.steps.find((step) => step.id === "step_set_toggle_state");
  const offStep = offWorkflow.steps.find((step) => step.id === "step_set_toggle_state");

  assert.equal(toggleStep?.action.type, "setToggleState");
  assert.equal(
    toggleStep?.action.type === "setToggleState" ? toggleStep.action.text : null,
    "Remember me"
  );
  assert.equal(
    toggleStep?.action.type === "setToggleState" ? toggleStep.action.state : null,
    "checked"
  );
  assert.equal(offStep?.action.type, "setToggleState");
  assert.equal(
    offStep?.action.type === "setToggleState" ? offStep.action.state : null,
    "unchecked"
  );
});

test("builds Clicky desktop workflows with wait-for-element actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky wait for the Login button and then click the Login button"
  );
  const waitStep = workflow.steps.find((step) => step.id === "step_wait_for_element");

  assert.equal(waitStep?.action.type, "waitForElement");
  assert.equal(
    waitStep?.action.type === "waitForElement" ? waitStep.action.text : null,
    "Login"
  );
  assert.equal(
    waitStep?.action.type === "waitForElement" ? waitStep.action.controlType : null,
    "button"
  );
});

test("builds Clicky desktop workflows with drag and mouse hold actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Paint app, drag from 100,150 to 300,350, hold right mouse, release right mouse, screenshot it"
  );
  const dragStep = workflow.steps.find((step) => step.id === "step_drag_mouse");
  const downStep = workflow.steps.find((step) => step.id === "step_mouse_down");
  const upStep = workflow.steps.find((step) => step.id === "step_mouse_up");

  assert.equal(dragStep?.action.type, "dragMouse");
  assert.equal(dragStep?.action.type === "dragMouse" ? dragStep.action.fromX : null, 100);
  assert.equal(dragStep?.action.type === "dragMouse" ? dragStep.action.fromY : null, 150);
  assert.equal(dragStep?.action.type === "dragMouse" ? dragStep.action.toX : null, 300);
  assert.equal(dragStep?.action.type === "dragMouse" ? dragStep.action.toY : null, 350);
  assert.equal(dragStep?.action.type === "dragMouse" ? dragStep.action.button : null, "right");
  assert.equal(downStep?.action.type, "mouseDown");
  assert.equal(downStep?.action.type === "mouseDown" ? downStep.action.button : null, "right");
  assert.equal(upStep?.action.type, "mouseUp");
  assert.equal(upStep?.action.type === "mouseUp" ? upStep.action.button : null, "right");
});

test("builds Clicky desktop workflows with close-window actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, close the current window, screenshot it"
  );
  const closeStep = workflow.steps.find((step) => step.id === "step_close_window");

  assert.equal(closeStep?.action.type, "closeWindow");
  assert.equal(closeStep?.action.type === "closeWindow" ? closeStep.action.force : null, true);
});

test("builds Clicky desktop workflows with focus-window actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky switch to the Chrome window, click the Login button, screenshot it"
  );
  const focusStep = workflow.steps.find((step) => step.id === "step_focus_window");

  assert.equal(focusStep?.action.type, "focusWindow");
  assert.equal(
    focusStep?.action.type === "focusWindow" ? focusStep.action.windowTitle : null,
    "Chrome"
  );
});

test("builds Clicky desktop workflows with list-window actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky show open windows and screenshot it"
  );
  const listStep = workflow.steps.find((step) => step.id === "step_list_windows");

  assert.equal(listStep?.action.type, "listWindows");
});

test("builds Clicky desktop workflows with UI element listing actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky show visible buttons in the current app"
  );
  const listStep = workflow.steps.find((step) => step.id === "step_list_ui_elements");

  assert.equal(listStep?.action.type, "listUiElements");
  assert.equal(
    listStep?.action.type === "listUiElements" ? listStep.action.controlType : null,
    "button"
  );
});

test("builds Clicky desktop workflows with visible text reading", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky read visible text from the current app and show me"
  );
  const readStep = workflow.steps.find((step) => step.id === "step_read_visible_text");

  assert.equal(readStep?.action.type, "readVisibleText");
  assert.equal(
    readStep?.action.type === "readVisibleText" ? readStep.action.maxTextItems : null,
    120
  );
});

test("builds Clicky desktop workflows with element state inspection", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky check state of the Remember me checkbox"
  );
  const stateStep = workflow.steps.find((step) => step.id === "step_get_element_state");

  assert.equal(stateStep?.action.type, "getElementState");
  assert.equal(
    stateStep?.action.type === "getElementState" ? stateStep.action.text : null,
    "Remember me"
  );
  assert.equal(
    stateStep?.action.type === "getElementState" ? stateStep.action.controlType : null,
    "checkbox"
  );
});

test("builds Clicky desktop workflows with field value reading", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky read the value of the Email field"
  );
  const valueStep = workflow.steps.find((step) => step.id === "step_get_element_value");

  assert.equal(valueStep?.action.type, "getElementValue");
  assert.equal(
    valueStep?.action.type === "getElementValue" ? valueStep.action.text : null,
    "Email"
  );
  assert.equal(
    valueStep?.action.type === "getElementValue" ? valueStep.action.controlType : null,
    "edit"
  );
});

test("builds Clicky desktop workflows with element invocation", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky press the Login button"
  );
  const invokeStep = workflow.steps.find((step) => step.id === "step_invoke_element");

  assert.equal(invokeStep?.action.type, "invokeElement");
  assert.equal(
    invokeStep?.action.type === "invokeElement" ? invokeStep.action.text : null,
    "Login"
  );
  assert.equal(
    invokeStep?.action.type === "invokeElement" ? invokeStep.action.controlType : null,
    "button"
  );
});

test("builds Clicky desktop workflows with window-state actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky maximize the Chrome window, screenshot it"
  );
  const activeWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky minimize the active window"
  );
  const stateStep = workflow.steps.find((step) => step.id === "step_set_window_state");
  const activeStateStep = activeWorkflow.steps.find((step) => step.id === "step_set_window_state");

  assert.equal(stateStep?.action.type, "setWindowState");
  assert.equal(
    stateStep?.action.type === "setWindowState" ? stateStep.action.state : null,
    "maximize"
  );
  assert.equal(
    stateStep?.action.type === "setWindowState" ? stateStep.action.windowTitle : null,
    "Chrome"
  );
  assert.equal(activeStateStep?.action.type, "setWindowState");
  assert.equal(
    activeStateStep?.action.type === "setWindowState" ? activeStateStep.action.state : null,
    "minimize"
  );
  assert.equal(
    activeStateStep?.action.type === "setWindowState" ? activeStateStep.action.windowTitle : null,
    undefined
  );
});

test("builds Clicky desktop workflows with clipboard actions", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, set clipboard to \"copied by Clicky\", paste it, screenshot it"
  );
  const setClipboardStep = workflow.steps.find((step) => step.id === "step_set_clipboard");
  const pasteStep = workflow.steps.find((step) => step.id === "step_key_press");
  const readWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky read the clipboard and show it to me"
  );

  assert.equal(setClipboardStep?.action.type, "setClipboard");
  assert.equal(
    setClipboardStep?.action.type === "setClipboard"
      ? setClipboardStep.action.text
      : null,
    "copied by Clicky"
  );
  assert.equal(pasteStep?.action.type, "keyPress");
  assert.equal(
    pasteStep?.action.type === "keyPress" ? pasteStep.action.key : null,
    "Control+v"
  );
  assert.equal(readWorkflow.steps[0]?.action.type, "getClipboard");
});

test("builds hybrid Clicky desktop workflows for app and website work", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, open rearvy.com, inspect competitors, screenshot it and show me"
  );
  const openWebsiteStep = workflow.steps.find(
    (step) => step.id === "step_open_browser_target"
  );

  assert.equal(workflow.name, "Clicky operate Notepad");
  assert.equal(openWebsiteStep?.action.type, "openPath");
  assert.equal(
    openWebsiteStep?.action.type === "openPath" ? openWebsiteStep.action.target : null,
    "https://rearvy.com"
  );
  assert.match(workflow.description, /browser target: https:\/\/rearvy\.com/);
});

test("builds generic browser step for hybrid Clicky website requests without URL", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app and open a website to inspect competitors"
  );
  const openBrowserStep = workflow.steps.find(
    (step) => step.id === "step_open_browser_target"
  );

  assert.equal(openBrowserStep?.name, "Open website");
  const target =
    openBrowserStep?.action.type === "openPath" ? openBrowserStep.action.target : null;
  assert.ok(target?.startsWith("https://www.google.com/search?q="));
  assert.match(decodeURIComponent(target ?? ""), /competitors/);
});

test("builds hybrid Clicky desktop workflows with competitor screenshot search", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky open Notepad app, open website, go on competitors page, log in, find screenshots, then show it to user"
  );
  const openWebsiteStep = workflow.steps.find(
    (step) => step.id === "step_open_browser_target"
  );
  const target =
    openWebsiteStep?.action.type === "openPath" ? openWebsiteStep.action.target : null;

  assert.equal(workflow.steps[0]?.action.type, "launchApp");
  assert.ok(target?.startsWith("https://www.google.com/search?q="));
  assert.match(decodeURIComponent(target ?? ""), /competitors/);
  assert.match(decodeURIComponent(target ?? ""), /screenshots/);
  assert.match(workflow.description, /browser target: https:\/\/www\.google\.com\/search/);
});

test("builds Clicky desktop workflows for file and command work", () => {
  const readWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky read the file \"C:\\Users\\Public\\notes.txt\" and show it to me"
  );
  const writeWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky create file \"C:\\Users\\Public\\clicky.txt\" with content: evidence draft"
  );
  const appendWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky append \"next line\" to file \"C:\\Users\\Public\\clicky.txt\" and open it"
  );
  const replaceWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky replace \"draft\" with \"final\" in file \"C:\\Users\\Public\\clicky.txt\""
  );
  const createFolderWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky create folder \"C:\\Users\\Public\\Rearvy Evidence\""
  );
  const copyPathWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky copy file \"C:\\Users\\Public\\notes.txt\" to \"C:\\Users\\Public\\notes-copy.txt\""
  );
  const movePathWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky rename file \"C:\\Users\\Public\\notes-copy.txt\" to \"C:\\Users\\Public\\notes-renamed.txt\""
  );
  const trashPathWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky delete file \"C:\\Users\\Public\\old-notes.txt\""
  );
  const commandWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky run command: echo ready"
  );
  const openWriteWorkflow = buildClickyDesktopOperatorWorkflow(
    "Clicky create file \"C:\\Users\\Public\\open-me.txt\" with content: evidence draft and open it"
  );

  assert.equal(readWorkflow.steps[0]?.action.type, "readFile");
  assert.equal(
    readWorkflow.steps[0]?.action.type === "readFile" ? readWorkflow.steps[0].action.path : null,
    "C:\\Users\\Public\\notes.txt"
  );
  assert.equal(writeWorkflow.steps[0]?.action.type, "writeFile");
  assert.equal(
    writeWorkflow.steps[0]?.action.type === "writeFile" ? writeWorkflow.steps[0].action.content : null,
    "evidence draft"
  );
  assert.equal(
    writeWorkflow.steps[0]?.action.type === "writeFile"
      ? writeWorkflow.steps[0].action.revealAfterWrite
      : null,
    true
  );
  assert.equal(
    writeWorkflow.steps[0]?.action.type === "writeFile"
      ? writeWorkflow.steps[0].action.openAfterWrite
      : null,
    false
  );
  assert.equal(appendWorkflow.steps[0]?.action.type, "appendToFile");
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\clicky.txt"
  );
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.content
      : null,
    "next line"
  );
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.revealAfterAppend
      : null,
    true
  );
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.openAfterAppend
      : null,
    true
  );
  assert.equal(replaceWorkflow.steps[0]?.action.type, "replaceInFile");
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\clicky.txt"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.search
      : null,
    "draft"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.replacement
      : null,
    "final"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.revealAfterReplace
      : null,
    true
  );
  assert.equal(
    openWriteWorkflow.steps[0]?.action.type === "writeFile"
      ? openWriteWorkflow.steps[0].action.openAfterWrite
      : null,
    true
  );
  assert.equal(
    openWriteWorkflow.steps[0]?.action.type === "writeFile"
      ? openWriteWorkflow.steps[0].action.content
      : null,
    "evidence draft"
  );
  assert.equal(createFolderWorkflow.steps[0]?.action.type, "createDirectory");
  assert.equal(
    createFolderWorkflow.steps[0]?.action.type === "createDirectory"
      ? createFolderWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\Rearvy Evidence"
  );
  assert.equal(
    createFolderWorkflow.steps[0]?.action.type === "createDirectory"
      ? createFolderWorkflow.steps[0].action.revealAfterCreate
      : null,
    true
  );
  assert.equal(copyPathWorkflow.steps[0]?.action.type, "copyPath");
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.sourcePath
      : null,
    "C:\\Users\\Public\\notes.txt"
  );
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.destinationPath
      : null,
    "C:\\Users\\Public\\notes-copy.txt"
  );
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.revealAfterCopy
      : null,
    true
  );
  assert.equal(movePathWorkflow.steps[0]?.action.type, "movePath");
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.sourcePath
      : null,
    "C:\\Users\\Public\\notes-copy.txt"
  );
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.destinationPath
      : null,
    "C:\\Users\\Public\\notes-renamed.txt"
  );
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.revealAfterMove
      : null,
    true
  );
  assert.equal(trashPathWorkflow.steps[0]?.action.type, "trashPath");
  assert.equal(
    trashPathWorkflow.steps[0]?.action.type === "trashPath"
      ? trashPathWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\old-notes.txt"
  );
  assert.equal(commandWorkflow.steps[0]?.action.type, "shellCommand");
  assert.equal(
    commandWorkflow.steps[0]?.action.type === "shellCommand" ? commandWorkflow.steps[0].action.command : null,
    "echo ready"
  );
});

test("detects direct desktop file and command workflow requests without Clicky wording", () => {
  assert.equal(
    hasDirectDesktopWorkflowIntent("read the file \"C:\\Users\\Public\\notes.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("list the folder \"C:\\Users\\Public\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("run command: echo ready"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("run npm run build"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("open terminal and run git status"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("write \"hello\" to file \"C:\\Users\\Public\\hello.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("append \"next\" to file \"C:\\Users\\Public\\hello.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("replace \"hello\" with \"hi\" in file \"C:\\Users\\Public\\hello.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("create folder \"C:\\Users\\Public\\Rearvy Evidence\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("copy file \"C:\\Users\\Public\\notes.txt\" to \"C:\\Users\\Public\\notes-copy.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("rename file \"C:\\Users\\Public\\notes-copy.txt\" to \"C:\\Users\\Public\\notes-renamed.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("delete file \"C:\\Users\\Public\\old-notes.txt\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("move file \"C:\\Users\\Public\\old-folder\" to recycle bin"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("delete my account"),
    false
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("set clipboard to \"hello\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("read the clipboard"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("click at 200,300"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("click the Login button"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("scroll down 500"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("drag from 100,150 to 200,250"),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("type \"hello\""),
    true
  );
  assert.equal(
    hasDirectDesktopWorkflowIntent("close the current window"),
    true
  );
  assert.equal(hasDirectDesktopWorkflowIntent("open google"), false);
  assert.equal(hasDirectDesktopWorkflowIntent("run Spotify"), false);
  assert.equal(hasDirectDesktopWorkflowIntent("show me revenue this month"), false);
});

test("builds direct desktop workflows without Clicky-branded labels", () => {
  const readWorkflow = buildDirectDesktopWorkflow(
    "read the file \"C:\\Users\\Public\\notes.txt\""
  );
  const commandWorkflow = buildDirectDesktopWorkflow("run command: echo ready");
  const naturalCommandWorkflow = buildDirectDesktopWorkflow("run npm run build");
  const writeWorkflow = buildDirectDesktopWorkflow(
    "create file \"C:\\Users\\Public\\direct-note.txt\" with content: done"
  );
  const appendWorkflow = buildDirectDesktopWorkflow(
    "append \"next\" to file \"C:\\Users\\Public\\direct-note.txt\" and open it"
  );
  const replaceWorkflow = buildDirectDesktopWorkflow(
    "replace \"done\" with \"ready\" in file \"C:\\Users\\Public\\direct-note.txt\" and open it"
  );
  const createFolderWorkflow = buildDirectDesktopWorkflow(
    "create folder \"C:\\Users\\Public\\Rearvy Evidence\" and open it"
  );
  const copyPathWorkflow = buildDirectDesktopWorkflow(
    "copy file \"C:\\Users\\Public\\notes.txt\" to \"C:\\Users\\Public\\notes-copy.txt\" and open it"
  );
  const movePathWorkflow = buildDirectDesktopWorkflow(
    "move file \"C:\\Users\\Public\\notes-copy.txt\" to \"C:\\Users\\Public\\archive\\notes-copy.txt\" and open it"
  );
  const trashPathWorkflow = buildDirectDesktopWorkflow(
    "delete file \"C:\\Users\\Public\\old-notes.txt\""
  );
  const contentFirstWriteWorkflow = buildDirectDesktopWorkflow(
    "write \"hello world\" to file \"C:\\Users\\Public\\hello.txt\" and open it"
  );
  const clickWorkflow = buildDirectDesktopWorkflow("click at 200,300");
  const clickElementWorkflow = buildDirectDesktopWorkflow("click the Login button");
  const typeIntoWorkflow = buildDirectDesktopWorkflow("enter \"hello\" into the Search field");
  const setValueWorkflow = buildDirectDesktopWorkflow("set the Email field to test@example.com");
  const selectWorkflow = buildDirectDesktopWorkflow("choose Enterprise from the Plan dropdown");
  const toggleWorkflow = buildDirectDesktopWorkflow("uncheck Subscribe checkbox");
  const waitWorkflow = buildDirectDesktopWorkflow("wait for the Login button");
  const listWindowsWorkflow = buildDirectDesktopWorkflow("show open windows");
  const listUiWorkflow = buildDirectDesktopWorkflow("list visible fields");
  const readTextWorkflow = buildDirectDesktopWorkflow("read visible text from the current window");
  const elementStateWorkflow = buildDirectDesktopWorkflow("is the Submit button enabled");
  const fieldValueWorkflow = buildDirectDesktopWorkflow("read the value of the Email field");
  const invokeElementWorkflow = buildDirectDesktopWorkflow("press the Login button");
  const focusWorkflow = buildDirectDesktopWorkflow("focus the Figma window");
  const windowStateWorkflow = buildDirectDesktopWorkflow("restore the Chrome window");
  const dragWorkflow = buildDirectDesktopWorkflow("drag from 100,150 to 200,250");
  const typeWorkflow = buildDirectDesktopWorkflow("type \"hello\"");
  const closeWorkflow = buildDirectDesktopWorkflow("close the current window");

  assert.equal(readWorkflow.name, "Read desktop file");
  assert.match(readWorkflow.description, /^Desktop workflow request:/);
  assert.equal(readWorkflow.steps[0]?.action.type, "readFile");
  assert.equal(commandWorkflow.name, "Run desktop command");
  assert.equal(commandWorkflow.steps[0]?.action.type, "shellCommand");
  assert.equal(naturalCommandWorkflow.steps[0]?.action.type, "shellCommand");
  assert.equal(
    naturalCommandWorkflow.steps[0]?.action.type === "shellCommand"
      ? naturalCommandWorkflow.steps[0].action.command
      : null,
    "npm run build"
  );
  assert.equal(writeWorkflow.name, "Write desktop file");
  assert.equal(writeWorkflow.steps[0]?.action.type, "writeFile");
  assert.equal(
    writeWorkflow.steps[0]?.action.type === "writeFile"
      ? writeWorkflow.steps[0].action.revealAfterWrite
      : null,
    true
  );
  assert.equal(appendWorkflow.name, "Append desktop file");
  assert.equal(appendWorkflow.steps[0]?.action.type, "appendToFile");
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\direct-note.txt"
  );
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.content
      : null,
    "next"
  );
  assert.equal(
    appendWorkflow.steps[0]?.action.type === "appendToFile"
      ? appendWorkflow.steps[0].action.openAfterAppend
      : null,
    true
  );
  assert.equal(replaceWorkflow.name, "Edit desktop file");
  assert.equal(replaceWorkflow.steps[0]?.action.type, "replaceInFile");
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\direct-note.txt"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.search
      : null,
    "done"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.replacement
      : null,
    "ready"
  );
  assert.equal(
    replaceWorkflow.steps[0]?.action.type === "replaceInFile"
      ? replaceWorkflow.steps[0].action.openAfterReplace
      : null,
    true
  );
  assert.equal(createFolderWorkflow.name, "Create desktop folder");
  assert.equal(createFolderWorkflow.steps[0]?.action.type, "createDirectory");
  assert.equal(
    createFolderWorkflow.steps[0]?.action.type === "createDirectory"
      ? createFolderWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\Rearvy Evidence"
  );
  assert.equal(
    createFolderWorkflow.steps[0]?.action.type === "createDirectory"
      ? createFolderWorkflow.steps[0].action.openAfterCreate
      : null,
    true
  );
  assert.equal(copyPathWorkflow.name, "Copy desktop path");
  assert.equal(copyPathWorkflow.steps[0]?.action.type, "copyPath");
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.sourcePath
      : null,
    "C:\\Users\\Public\\notes.txt"
  );
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.destinationPath
      : null,
    "C:\\Users\\Public\\notes-copy.txt"
  );
  assert.equal(
    copyPathWorkflow.steps[0]?.action.type === "copyPath"
      ? copyPathWorkflow.steps[0].action.openAfterCopy
      : null,
    true
  );
  assert.equal(movePathWorkflow.name, "Move desktop path");
  assert.equal(movePathWorkflow.steps[0]?.action.type, "movePath");
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.sourcePath
      : null,
    "C:\\Users\\Public\\notes-copy.txt"
  );
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.destinationPath
      : null,
    "C:\\Users\\Public\\archive\\notes-copy.txt"
  );
  assert.equal(
    movePathWorkflow.steps[0]?.action.type === "movePath"
      ? movePathWorkflow.steps[0].action.openAfterMove
      : null,
    true
  );
  assert.equal(trashPathWorkflow.name, "Trash desktop path");
  assert.equal(trashPathWorkflow.steps[0]?.action.type, "trashPath");
  assert.equal(
    trashPathWorkflow.steps[0]?.action.type === "trashPath"
      ? trashPathWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\old-notes.txt"
  );
  assert.equal(contentFirstWriteWorkflow.name, "Write desktop file");
  assert.equal(contentFirstWriteWorkflow.steps[0]?.action.type, "writeFile");
  assert.equal(
    contentFirstWriteWorkflow.steps[0]?.action.type === "writeFile"
      ? contentFirstWriteWorkflow.steps[0].action.path
      : null,
    "C:\\Users\\Public\\hello.txt"
  );
  assert.equal(
    contentFirstWriteWorkflow.steps[0]?.action.type === "writeFile"
      ? contentFirstWriteWorkflow.steps[0].action.content
      : null,
    "hello world"
  );
  assert.equal(
    contentFirstWriteWorkflow.steps[0]?.action.type === "writeFile"
      ? contentFirstWriteWorkflow.steps[0].action.openAfterWrite
      : null,
    true
  );
  assert.equal(clickWorkflow.name, "Click desktop");
  assert.equal(
    clickWorkflow.steps.find((step) => step.id === "step_click")?.action.type,
    "click"
  );
  assert.equal(clickElementWorkflow.name, "Click desktop element");
  assert.equal(
    clickElementWorkflow.steps.find((step) => step.id === "step_click_element")?.action.type,
    "clickElement"
  );
  assert.equal(typeIntoWorkflow.name, "Type into desktop field");
  assert.equal(
    typeIntoWorkflow.steps.find((step) => step.id === "step_type_into_element")?.action.type,
    "typeIntoElement"
  );
  assert.equal(setValueWorkflow.name, "Set desktop field value");
  assert.equal(
    setValueWorkflow.steps.find((step) => step.id === "step_set_element_value")?.action.type,
    "setElementValue"
  );
  assert.equal(selectWorkflow.name, "Select desktop option");
  assert.equal(
    selectWorkflow.steps.find((step) => step.id === "step_select_option")?.action.type,
    "selectOption"
  );
  assert.equal(toggleWorkflow.name, "Set desktop toggle");
  assert.equal(
    toggleWorkflow.steps.find((step) => step.id === "step_set_toggle_state")?.action.type,
    "setToggleState"
  );
  assert.equal(waitWorkflow.name, "Wait for desktop element");
  assert.equal(
    waitWorkflow.steps.find((step) => step.id === "step_wait_for_element")?.action.type,
    "waitForElement"
  );
  assert.equal(listWindowsWorkflow.name, "List desktop windows");
  assert.equal(
    listWindowsWorkflow.steps.find((step) => step.id === "step_list_windows")?.action.type,
    "listWindows"
  );
  assert.equal(listUiWorkflow.name, "List desktop UI elements");
  assert.equal(
    listUiWorkflow.steps.find((step) => step.id === "step_list_ui_elements")?.action.type,
    "listUiElements"
  );
  assert.equal(readTextWorkflow.name, "Read desktop visible text");
  assert.equal(
    readTextWorkflow.steps.find((step) => step.id === "step_read_visible_text")?.action.type,
    "readVisibleText"
  );
  assert.equal(elementStateWorkflow.name, "Get desktop element state");
  assert.equal(
    elementStateWorkflow.steps.find((step) => step.id === "step_get_element_state")?.action.type,
    "getElementState"
  );
  assert.equal(fieldValueWorkflow.name, "Read desktop field value");
  assert.equal(
    fieldValueWorkflow.steps.find((step) => step.id === "step_get_element_value")?.action.type,
    "getElementValue"
  );
  assert.equal(invokeElementWorkflow.name, "Invoke desktop element");
  assert.equal(
    invokeElementWorkflow.steps.find((step) => step.id === "step_invoke_element")?.action.type,
    "invokeElement"
  );
  assert.equal(focusWorkflow.name, "Focus desktop window");
  assert.equal(
    focusWorkflow.steps.find((step) => step.id === "step_focus_window")?.action.type,
    "focusWindow"
  );
  assert.equal(windowStateWorkflow.name, "Change desktop window state");
  assert.equal(
    windowStateWorkflow.steps.find((step) => step.id === "step_set_window_state")?.action.type,
    "setWindowState"
  );
  assert.equal(dragWorkflow.name, "Drag desktop cursor");
  assert.equal(
    dragWorkflow.steps.find((step) => step.id === "step_drag_mouse")?.action.type,
    "dragMouse"
  );
  assert.equal(typeWorkflow.name, "Type on desktop");
  assert.equal(
    typeWorkflow.steps.find((step) => step.id === "step_type_text")?.action.type,
    "type"
  );
  assert.equal(closeWorkflow.name, "Close desktop window");
  assert.equal(
    closeWorkflow.steps.find((step) => step.id === "step_close_window")?.action.type,
    "closeWindow"
  );
});

test("builds Clicky desktop operator fallback for current app inspection", () => {
  const workflow = buildClickyDesktopOperatorWorkflow(
    "Clicky work on that app and show the screenshot to user"
  );

  assert.equal(workflow.name, "Clicky inspect desktop");
  assert.equal(workflow.steps[0]?.action.type, "screenshot");
  assert.equal(workflow.steps.length, 3);
});
