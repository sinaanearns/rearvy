const { createLogger } = require("./logger.cjs");

const log = createLogger("SerialPorts");

function isMissingModuleError(error, moduleName) {
  return (
    Boolean(error) &&
    typeof error === "object" &&
    ((error.code === "MODULE_NOT_FOUND" && String(error.message || "").includes(moduleName)) ||
      String(error.message || "").includes(`Cannot find module '${moduleName}'`) ||
      String(error.message || "").includes(`Cannot find module "${moduleName}"`))
  );
}

function loadOptionalModule(loadModule, moduleName) {
  try {
    return loadModule(moduleName);
  } catch (error) {
    if (!isMissingModuleError(error, moduleName)) {
      throw error;
    }
    return null;
  }
}

function resolveListFunction(moduleValue) {
  if (!moduleValue) {
    return null;
  }

  if (typeof moduleValue.list === "function") {
    return moduleValue.list.bind(moduleValue);
  }

  if (typeof moduleValue.SerialPort?.list === "function") {
    return moduleValue.SerialPort.list.bind(moduleValue.SerialPort);
  }

  if (typeof moduleValue.default?.list === "function") {
    return moduleValue.default.list.bind(moduleValue.default);
  }

  if (typeof moduleValue.default?.SerialPort?.list === "function") {
    return moduleValue.default.SerialPort.list.bind(moduleValue.default.SerialPort);
  }

  if (typeof moduleValue === "function") {
    return moduleValue;
  }

  return null;
}

async function listSerialPortsFromModules(loadModule) {
  try {
    const serialportModule = loadOptionalModule(loadModule, "serialport");
    let list = resolveListFunction(serialportModule);

    let listModule = null;
    if (!list) {
      listModule = loadOptionalModule(loadModule, "@serialport/list");
      list = resolveListFunction(listModule);
    }

    if (!list) {
      return {
        ok: false,
        ports: [],
        message: listModule || serialportModule ? "serialport list API is unavailable" : "serialport not installed",
      };
    }

    const ports = await list();
    if (!Array.isArray(ports)) {
      return { ok: false, ports: [], message: "serialport returned an invalid ports payload" };
    }

    return { ok: true, ports };
  } catch (error) {
    log.error("desktop:device:list-serial-ports failed:", error);
    return { ok: false, ports: [], message: error?.message || String(error) };
  }
}

async function listSerialPorts() {
  return listSerialPortsFromModules(require);
}

module.exports = {
  listSerialPorts,
  listSerialPortsFromModules,
  resolveListFunction,
};
