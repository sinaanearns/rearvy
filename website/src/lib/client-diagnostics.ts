type ClientDiagnosticMethod = "debug" | "error" | "info" | "warn";

const diagnosticsEnabled = process.env.NODE_ENV !== "production";

export function createClientLogger(scope = "") {
  const prefix = scope ? `[${scope}]` : "";

  function write(method: ClientDiagnosticMethod, args: unknown[]) {
    if (!diagnosticsEnabled) {
      return;
    }

    if (prefix) {
      console[method](prefix, ...args);
      return;
    }

    console[method](...args);
  }

  return {
    debug: (...args: unknown[]) => write("debug", args),
    error: (...args: unknown[]) => write("error", args),
    info: (...args: unknown[]) => write("info", args),
    warn: (...args: unknown[]) => write("warn", args),
  };
}
