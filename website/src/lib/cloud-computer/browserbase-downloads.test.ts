import assert from "node:assert/strict";
import test from "node:test";

import {
  buildBrowserbaseDownloadsFallbackFileName,
  extractBrowserbaseDownloadFilename,
} from "./browserbase-downloads";

test("extractBrowserbaseDownloadFilename decodes RFC 5987 filenames", () => {
  assert.equal(
    extractBrowserbaseDownloadFilename("attachment; filename*=UTF-8''sales%20report.zip"),
    "sales report.zip"
  );
});

test("extractBrowserbaseDownloadFilename sanitizes provider filenames", () => {
  assert.equal(
    extractBrowserbaseDownloadFilename('attachment; filename="..\\\\secret;\\\"final\\\".zip"'),
    "..-secret-final-.zip"
  );
  assert.equal(extractBrowserbaseDownloadFilename("attachment; filename=\r\n"), null);
});

test("buildBrowserbaseDownloadsFallbackFileName sanitizes provider session ids", () => {
  assert.equal(
    buildBrowserbaseDownloadsFallbackFileName("../session\\id"),
    "browserbase-downloads-session-id.zip"
  );
});
