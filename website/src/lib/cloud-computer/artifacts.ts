const MAX_FILE_NAME_LENGTH = 160;
const MAX_PATH_SEGMENT_LENGTH = 120;

export function sanitizeCloudComputerFileName(value: string) {
  const cleaned = value
    .replace(/[\x00-\x1f\x7f/\\?%*:|"<>;]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_FILE_NAME_LENGTH);

  return cleaned || "artifact";
}

export function sanitizeCloudComputerPathSegment(value: string, fallback: string) {
  const cleaned = value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, MAX_PATH_SEGMENT_LENGTH)
    .replace(/^[-_]+|[-_]+$/g, "");

  return cleaned || fallback;
}

export function buildCloudComputerArtifactStoragePath(params: {
  userId: string;
  sessionId: string;
  artifactId: string;
  fileName: string;
  timestamp?: number;
}) {
  const timestamp =
    typeof params.timestamp === "number" && Number.isFinite(params.timestamp) && params.timestamp > 0
      ? Math.trunc(params.timestamp)
      : Date.now();
  const userSegment = sanitizeCloudComputerPathSegment(params.userId, "user");
  const sessionSegment = sanitizeCloudComputerPathSegment(params.sessionId, "session");
  const artifactSegment = sanitizeCloudComputerPathSegment(params.artifactId, "artifact");
  const fileName = sanitizeCloudComputerFileName(params.fileName);

  return `cloud-computer/${userSegment}/${sessionSegment}/${timestamp}-${artifactSegment}-${fileName}`;
}

export function formatCloudComputerContentDisposition(
  disposition: "inline" | "attachment",
  fileName: string
) {
  return `${disposition}; filename="${sanitizeCloudComputerFileName(fileName)}"`;
}
