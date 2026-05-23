const LEVELS = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function normalizeLevel(value) {
  const level = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : null;
}

const configuredLevel =
  normalizeLevel(process.env.REARVY_LOG_LEVEL) ||
  (process.env.NODE_ENV === "production" ? "warn" : "info");

function shouldLog(level) {
  return LEVELS[level] <= LEVELS[configuredLevel];
}

function createLogger(scope = "") {
  const prefix = scope ? `[${scope}]` : "";

  function write(method, level, args) {
    if (!shouldLog(level)) {
      return;
    }

    if (prefix) {
      console[method](prefix, ...args);
      return;
    }

    console[method](...args);
  }

  return {
    error: (...args) => write("error", "error", args),
    warn: (...args) => write("warn", "warn", args),
    info: (...args) => write("log", "info", args),
    debug: (...args) => write("log", "debug", args),
  };
}

module.exports = {
  createLogger,
  configuredLevel,
};
