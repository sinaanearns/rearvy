const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { test } = require("node:test");

test("preload exposes the Maria bridge without local CommonJS imports", () => {
  const preloadPath = path.join(__dirname, "preload.cjs");
  const source = fs.readFileSync(preloadPath, "utf8");
  const sentMessages = [];
  const dispatchedEvents = [];
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
    invoke: async () => undefined,
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
  assert.equal(fakeWindow.__electronReady, true);
  assert.ok(sentMessages.some(([channel]) => channel === "preload:loading"));
  assert.ok(sentMessages.some(([channel]) => channel === "preload:ready"));
  assert.ok(dispatchedEvents.some((event) => event.type === "rearvy-electron-ready"));
});
