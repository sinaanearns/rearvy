const { createLogger } = require("./logger.cjs");

const log = createLogger("SerialPorts");

async function listSerialPorts() {
  try {
    let listModule = null;

    try {
      listModule = require("@serialport/list");
    } catch {
      // Optional dependency; fall through to serialport compatibility path.
    }

    if (!listModule) {
      try {
        listModule = require("serialport");
      } catch {
        // Optional dependency; report a structured unavailable response below.
      }
    }

    if (!listModule) {
      return { ok: false, ports: [], message: "serialport not installed" };
    }

    if (typeof listModule.list === "function") {
      const ports = await listModule.list();
      return { ok: true, ports };
    }

    if (typeof listModule === "function") {
      const ports = await listModule();
      return { ok: true, ports };
    }

    return { ok: false, ports: [], message: "no list() available" };
  } catch (error) {
    log.error("desktop:device:list-serial-ports failed:", error);
    return { ok: false, ports: [], message: error?.message || String(error) };
  }
}

module.exports = {
  listSerialPorts,
};
