"use strict";

/**
 * Read-only Electron IPC for the bundled agent-desktop binary.
 *
 * OS-changing operations deliberately stay inside WorkflowExecutor, where
 * Rearvy presents the complete plan and requires user approval before input
 * is sent to another application. This module exposes observation and health
 * capabilities to the trusted renderer without creating a remote-control
 * escape hatch through contextBridge.
 */

const agentDesktop = require("./agent-desktop-bridge.cjs");

function assertTrustedSender(event, isTrustedSender) {
  if (typeof isTrustedSender === "function" && !isTrustedSender(event)) {
    throw new Error("Desktop agent request rejected from an untrusted renderer.");
  }
}

function readOnlyHandler(handler, isTrustedSender) {
  return async (event, ...args) => {
    assertTrustedSender(event, isTrustedSender);
    return handler(...args);
  };
}

function blockedControlHandler(event, isTrustedSender) {
  assertTrustedSender(event, isTrustedSender);
  throw new Error(
    "Direct desktop control is disabled. Start an approval-gated Rearvy desktop workflow instead."
  );
}

function setupAgentDesktopIPC(ipcMain, { isTrustedSender } = {}) {
  if (!ipcMain || typeof ipcMain.handle !== "function") {
    throw new TypeError("ipcMain.handle is required to register agent-desktop IPC.");
  }

  const readOnlyHandlers = {
    "desktop:agent:health": () => agentDesktop.healthCheck(),
    "desktop:agent:status": () => agentDesktop.status(),
    "desktop:agent:permissions": () => agentDesktop.permissions(),
    "desktop:agent:version": () => agentDesktop.version(),
    "desktop:agent:snapshot": (app, options) => agentDesktop.snapshot(app, options),
    "desktop:agent:find": (filter, options) => agentDesktop.find(filter, options),
    "desktop:agent:screenshot": (options) => agentDesktop.screenshot(options),
    "desktop:agent:list-windows": (filter, options) => agentDesktop.listWindows(filter, options),
    "desktop:agent:list-apps": (appFilter, options) => agentDesktop.listApps(appFilter, options),
    "desktop:agent:list-displays": (options) => agentDesktop.listDisplays(options),
    "desktop:agent:session-list": () => agentDesktop.sessionList(),
    "desktop:agent:trace-show": (sessionId, limit) => agentDesktop.traceShow(sessionId, limit),
  };

  for (const [channel, handler] of Object.entries(readOnlyHandlers)) {
    ipcMain.handle(channel, readOnlyHandler(handler, isTrustedSender));
  }

  const controlChannels = [
    "desktop:agent:run-command",
    "desktop:agent:click",
    "desktop:agent:type",
    "desktop:agent:press",
    "desktop:agent:scroll",
    "desktop:agent:wait",
    "desktop:agent:mouse-move",
    "desktop:agent:mouse-click",
    "desktop:agent:mouse-wheel",
    "desktop:agent:drag",
    "desktop:agent:hover",
    "desktop:agent:clipboard-get",
    "desktop:agent:clipboard-set",
    "desktop:agent:clipboard-clear",
    "desktop:agent:focus-window",
    "desktop:agent:launch",
    "desktop:agent:close-app",
    "desktop:agent:session-start",
    "desktop:agent:session-end",
    "desktop:agent:session-gc",
    "desktop:agent:trace-export",
    "desktop:agent:batch",
  ];

  for (const channel of controlChannels) {
    ipcMain.handle(channel, (event) => blockedControlHandler(event, isTrustedSender));
  }
}

module.exports = { setupAgentDesktopIPC };
