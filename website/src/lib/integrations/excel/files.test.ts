import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";

import {
  buildExcelImportRelativePath,
  normalizeExcelImportRelativePath,
  resolveExcelImportPublicPath,
  sanitizeExcelFileName,
} from "./files";

test("sanitizeExcelFileName removes path and header control characters", () => {
  assert.equal(
    sanitizeExcelFileName('..\\sales;\r\n"final".xlsx'),
    "sales-final-.xlsx"
  );
  assert.equal(sanitizeExcelFileName("\u0000\r\n"), "workbook");
});

test("buildExcelImportRelativePath creates stable public import paths", () => {
  assert.equal(
    buildExcelImportRelativePath("../client\\orders.csv", 1234.9),
    "excel-imports/1234-client-orders.csv"
  );
});

test("normalizeExcelImportRelativePath accepts existing slash styles", () => {
  assert.equal(
    normalizeExcelImportRelativePath("excel-imports\\1234-workbook.xlsx"),
    "excel-imports/1234-workbook.xlsx"
  );
  assert.equal(
    normalizeExcelImportRelativePath("excel-imports/1234-workbook.xlsx"),
    "excel-imports/1234-workbook.xlsx"
  );
});

test("normalizeExcelImportRelativePath rejects traversal and absolute paths", () => {
  assert.equal(normalizeExcelImportRelativePath("../secret.xlsx"), null);
  assert.equal(normalizeExcelImportRelativePath("excel-imports/../secret.xlsx"), null);
  assert.equal(normalizeExcelImportRelativePath("/excel-imports/workbook.xlsx"), null);
});

test("resolveExcelImportPublicPath keeps resolved files under public", () => {
  const cwd = path.resolve("repo");
  assert.equal(
    resolveExcelImportPublicPath(cwd, "excel-imports/1234-workbook.xlsx"),
    path.join(cwd, "public", "excel-imports", "1234-workbook.xlsx")
  );
  assert.equal(resolveExcelImportPublicPath(cwd, "excel-imports/../../secret.xlsx"), null);
});
