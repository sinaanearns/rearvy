const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  listSerialPortsFromModules,
  resolveListFunction,
} = require("./serial-ports.cjs");

test("resolves the serialport v13 SerialPort.list export", async () => {
  const expectedPorts = [{ path: "COM7" }];
  const list = async () => expectedPorts;

  const resolved = resolveListFunction({
    SerialPort: {
      list,
    },
  });

  assert.equal(typeof resolved, "function");
  assert.deepEqual(await resolved(), expectedPorts);
});

test("falls back from an unusable @serialport/list export to serialport.SerialPort.list", async () => {
  const expectedPorts = [{ path: "COM7" }];
  const seenModules = [];

  const result = await listSerialPortsFromModules((moduleName) => {
    seenModules.push(moduleName);

    if (moduleName === "@serialport/list") {
      return {};
    }

    if (moduleName === "serialport") {
      return {
        SerialPort: {
          list: async () => expectedPorts,
        },
      };
    }

    throw new Error(`Unexpected module request: ${moduleName}`);
  });

  assert.deepEqual(seenModules, ["@serialport/list", "serialport"]);
  assert.deepEqual(result, { ok: true, ports: expectedPorts });
});

test("returns a safe structured failure when serialport is unavailable", async () => {
  const result = await listSerialPortsFromModules((moduleName) => {
    const error = new Error(`Cannot find module '${moduleName}'`);
    error.code = "MODULE_NOT_FOUND";
    throw error;
  });

  assert.deepEqual(result, {
    ok: false,
    ports: [],
    message: "serialport not installed",
  });
});

test("returns a safe structured failure when the loader rejects", async () => {
  const result = await listSerialPortsFromModules((moduleName) => {
    if (moduleName === "@serialport/list") {
      return {};
    }

    throw new Error("native binding unavailable");
  });

  assert.deepEqual(result, {
    ok: false,
    ports: [],
    message: "native binding unavailable",
  });
});
