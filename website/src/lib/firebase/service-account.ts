import { isRecord } from "@/lib/api/request-body";
import { parseJsonRecord, parseJsonValue } from "@/lib/ai/json-object";

export type FirebaseServiceAccount = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

export function normalizeRawEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith("\"") && trimmed.endsWith("\"")) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function escapeMultilinePrivateKey(rawValue: string): string {
  return rawValue
    .replace(
      /"private_key"\s*:\s*"([\s\S]*?)"/,
      (_match, privateKey: string) =>
        `"private_key":"${privateKey.replace(/\r?\n/g, "\\n")}"`
    )
    .replace(
      /"privateKey"\s*:\s*"([\s\S]*?)"/,
      (_match, privateKey: string) =>
        `"privateKey":"${privateKey.replace(/\r?\n/g, "\\n")}"`
    );
}

function decodeBase64Json(value: string) {
  try {
    const decoded = Buffer.from(value, "base64").toString("utf8");
    return decoded && decoded !== value && decoded.trim().startsWith("{")
      ? decoded.trim()
      : null;
  } catch {
    return null;
  }
}

function readParsedRecord(value: string) {
  const parsed = parseJsonRecord(value);
  if (parsed) {
    return parsed;
  }

  const parsedValue = parseJsonValue(value);
  return typeof parsedValue === "string" ? parseJsonRecord(parsedValue) : null;
}

function normalizeServiceAccountRecord(
  parsed: Record<string, unknown>
): FirebaseServiceAccount {
  const privateKey =
    typeof parsed.privateKey === "string"
      ? parsed.privateKey
      : typeof parsed.private_key === "string"
        ? parsed.private_key
        : undefined;

  if (!privateKey) {
    throw new Error("Missing or invalid private key field");
  }

  const projectId =
    typeof parsed.projectId === "string"
      ? parsed.projectId
      : typeof parsed.project_id === "string"
        ? parsed.project_id
        : undefined;

  const clientEmail =
    typeof parsed.clientEmail === "string"
      ? parsed.clientEmail
      : typeof parsed.client_email === "string"
        ? parsed.client_email
        : undefined;

  if (!projectId || !clientEmail) {
    throw new Error(
      `Missing required fields: projectId=${!!projectId}, clientEmail=${!!clientEmail}`
    );
  }

  return {
    projectId,
    clientEmail,
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };
}

export function parseServiceAccountEnv(rawValue: string): FirebaseServiceAccount {
  const trimmedValue = rawValue.trim();
  const normalizedValue = normalizeRawEnvValue(rawValue);
  const candidateValues = [
    trimmedValue,
    normalizedValue,
    decodeBase64Json(normalizedValue),
  ].filter(
    (value, index, values): value is string =>
      typeof value === "string" && values.indexOf(value) === index
  );

  let lastError: unknown = null;

  for (const candidate of candidateValues) {
    for (const variant of [candidate, escapeMultilinePrivateKey(candidate)]) {
      try {
        const parsed = readParsedRecord(variant);
        if (!isRecord(parsed)) {
          throw new Error("Service account value must be a JSON object");
        }
        return normalizeServiceAccountRecord(parsed);
      } catch (error) {
        lastError = error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Invalid FIREBASE_SERVICE_ACCOUNT value.");
}
