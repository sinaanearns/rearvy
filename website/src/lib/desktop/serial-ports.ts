export type DesktopSerialPort = Record<string, unknown>;

export type DesktopSerialPortListResult = {
  ok: boolean;
  ports: DesktopSerialPort[];
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeMessage(message: unknown, fallback: string) {
  return typeof message === "string" && message.trim() ? message : fallback;
}

export function normalizeDesktopSerialPortListResult(
  value: unknown
): DesktopSerialPortListResult {
  if (Array.isArray(value)) {
    return { ok: true, ports: value };
  }

  if (!isRecord(value) || !Array.isArray(value.ports)) {
    return {
      ok: false,
      ports: [],
      message: "Device bridge returned an invalid response.",
    };
  }

  const ok = value.ok !== false;
  const ports = value.ports as DesktopSerialPort[];

  if (!ok) {
    return {
      ok: false,
      ports,
      message: normalizeMessage(value.message, "Serial port enumeration is unavailable."),
    };
  }

  const messageStr = typeof value.message === "string" && value.message.trim() ? value.message : undefined;
  if (messageStr !== undefined) {
    return { ok: true, ports, message: messageStr };
  }

  return { ok: true, ports };
}
