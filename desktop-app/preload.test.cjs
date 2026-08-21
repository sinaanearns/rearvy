const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

test("preload exposes the Maria and device bridges without local CommonJS imports", async () => {
  const preloadPath = path.join(__dirname, "preload.cjs");
  const source = fs.readFileSync(preloadPath, "utf8");
  const sentMessages = [];
  const dispatchedEvents = [];
  const invokedMessages = [];
  const fakeWindow = {
    dispatchEvent(event) {
      dispatchedEvents.push(event);
    },
  };
  const fakeConsole = {
    log() {},
    info() {},
    warn() {},
    error() {},
    debug() {},
  };
  const fakeIpcRenderer = {
    send(...args) {
      sentMessages.push(args);
    },
    invoke: async (...args) => {
      invokedMessages.push(args);
      if (args[0] === "desktop:device:list-serial-ports") {
        return {
          ok: true,
          ports: [{ path: "COM7" }],
        };
      }

      return undefined;
    },
    on() {},
    removeListener() {},
  };
  const fakeContextBridge = {
    exposeInMainWorld(name, api) {
      fakeWindow[name] = api;
    },
  };

  vm.runInNewContext(
    source,
    {
      require(specifier) {
        if (specifier === "electron") {
          return {
            contextBridge: fakeContextBridge,
            ipcRenderer: fakeIpcRenderer,
          };
        }

        throw new Error(`Sandboxed preload cannot import ${specifier}`);
      },
      window: fakeWindow,
      console: fakeConsole,
      queueMicrotask(callback) {
        callback();
      },
      setTimeout(callback) {
        callback();
        return 1;
      },
      clearTimeout() {},
      Promise,
      CustomEvent: class CustomEvent {
        constructor(type, init = {}) {
          this.type = type;
          this.detail = init.detail;
        }
      },
    },
    { filename: preloadPath }
  );

  assert.equal(typeof fakeWindow.electron, "object");
  assert.equal(typeof fakeWindow.electron.maria?.runCommand, "function");
  assert.equal(typeof fakeWindow.electron.maria?.getReadiness, "function");
  assert.equal(typeof fakeWindow.electron.device?.listSerialPorts, "function");
  assert.equal(typeof fakeWindow.electron.clipboard?.writeText, "function");
  assert.equal(typeof fakeWindow.electron.agentDesktop?.health, "function");
  assert.equal(typeof fakeWindow.electron.agentDesktop?.mouseClick, "undefined");
  assert.equal(typeof fakeWindow.electron.automation?.getBackendCapabilities, "function");
  assert.deepEqual(await fakeWindow.electron.device.listSerialPorts(), {
    ok: true,
    ports: [{ path: "COM7" }],
  });
  assert.ok(
    invokedMessages.some(([channel]) => channel === "desktop:device:list-serial-ports")
  );
  await fakeWindow.electron.clipboard.writeText("Rearvy report");
  assert.ok(
    invokedMessages.some(([channel, payload]) =>
      channel === "desktop:clipboard:write-text" && payload?.text === "Rearvy report"
    )
  );
  assert.equal(fakeWindow.__electronReady, true);
  assert.ok(sentMessages.some(([channel]) => channel === "preload:loading"));
  assert.ok(sentMessages.some(([channel]) => channel === "preload:ready"));
  assert.ok(dispatchedEvents.some((event) => event.type === "rearvy-electron-ready"));
});
