import path from "path";

const EXCEL_IMPORTS_DIRECTORY = "excel-imports";
const MAX_EXCEL_FILE_NAME_LENGTH = 160;

export function sanitizeExcelFileName(name: string) {
  const normalized = name
    .replace(/[\x00-\x1f\x7f/\\?%*:|"<>;]+/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, MAX_EXCEL_FILE_NAME_LENGTH);

  return normalized.length > 0 ? normalized : "workbook";
}

export function buildExcelImportRelativePath(fileName: string, timestamp = Date.now()) {
  const safeTimestamp = Number.isFinite(timestamp) && timestamp > 0
    ? Math.trunc(timestamp)
    : Date.now();

  return `${EXCEL_IMPORTS_DIRECTORY}/${safeTimestamp}-${sanitizeExcelFileName(fileName)}`;
}

export function normalizeExcelImportRelativePath(value: string) {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0")) {
    return null;
  }

  const parts = normalized.split("/");
  if (parts.length !== 2 || parts[0] !== EXCEL_IMPORTS_DIRECTORY) {
    return null;
  }

  const fileName = parts[1];
  if (!fileName || fileName === "." || fileName === "..") {
    return null;
  }

  return `${EXCEL_IMPORTS_DIRECTORY}/${fileName}`;
}

export function resolveExcelImportPublicPath(cwd: string, relativePath: string) {
  const normalized = normalizeExcelImportRelativePath(relativePath);
  if (!normalized) {
    return null;
  }

  const publicRoot = path.resolve(cwd, "public");
  const absolutePath = path.resolve(publicRoot, normalized);
  const publicRelativePath = path.relative(publicRoot, absolutePath);

  if (publicRelativePath.startsWith("..") || path.isAbsolute(publicRelativePath)) {
    return null;
  }

  return absolutePath;
}
