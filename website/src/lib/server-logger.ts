type LogLevel = "silent" | "error" | "warn" | "info" | "debug";

const LEVELS: Record<LogLevel, number> = {
  silent: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

function normalizeLogLevel(value: unknown): LogLevel | null {
  const level = String(value || "").toLowerCase();
  return Object.prototype.hasOwnProperty.call(LEVELS, level) ? (level as LogLevel) : null;
}

const configuredLogLevel =
  normalizeLogLevel(process.env.REARVY_LOG_LEVEL) ||
  (process.env.NODE_ENV === "production" ? "warn" : "info");

function shouldLog(level: Exclude<LogLevel, "silent">): boolean {
  return LEVELS[level] <= LEVELS[configuredLogLevel];
}

export function createServerLogger(scope = "") {
  const prefix = scope ? `[${scope}]` : "";

  function write(method: "debug" | "error" | "info" | "warn", level: Exclude<LogLevel, "silent">, args: unknown[]) {
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
    debug: (...args: unknown[]) => write("debug", "debug", args),
    error: (...args: unknown[]) => write("error", "error", args),
    info: (...args: unknown[]) => write("info", "info", args),
    warn: (...args: unknown[]) => write("warn", "warn", args),
  };
}
