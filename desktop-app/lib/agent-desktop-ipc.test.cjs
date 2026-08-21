"use strict";

const assert = require("node:assert/strict");
const { test } = require("node:test");

test("agent-desktop IPC exposes observation but blocks direct OS control", async () => {
  const bridgePath = require.resolve("./agent-desktop-bridge.cjs");
  const ipcPath = require.resolve("./agent-desktop-ipc.cjs");
  const originalBridge = require.cache[bridgePath];

  require.cache[bridgePath] = {
    id: bridgePath,
    filename: bridgePath,
    loaded: true,
    exports: {
      healthCheck: async () => ({ available: true }),
      listWindows: async () => ({ windows: [] }),
    },
  };
  delete require.cache[ipcPath];

  try {
    const { setupAgentDesktopIPC } = require("./agent-desktop-ipc.cjs");
    const handlers = new Map();
    setupAgentDesktopIPC({ handle: (channel, handler) => handlers.set(channel, handler) }, {
      isTrustedSender: (event) => event.sender === "rearvy",
    });

    assert.deepEqual(await handlers.get("desktop:agent:health")({ sender: "rearvy" }), { available: true });
    assert.throws(
      () => handlers.get("desktop:agent:mouse-click")({ sender: "rearvy" }, 10, 20),
      /approval-gated Rearvy desktop workflow/
    );
    await assert.rejects(
      () => handlers.get("desktop:agent:list-windows")({ sender: "other" }),
      /untrusted renderer/
    );
  } finally {
    delete require.cache[ipcPath];
    if (originalBridge) require.cache[bridgePath] = originalBridge;
    else delete require.cache[bridgePath];
  }
});
