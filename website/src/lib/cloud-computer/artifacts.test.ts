import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCloudComputerArtifactStoragePath,
  formatCloudComputerContentDisposition,
  sanitizeCloudComputerFileName,
  sanitizeCloudComputerPathSegment,
} from "./artifacts";

test("sanitizeCloudComputerFileName removes path and header control characters", () => {
  assert.equal(
    sanitizeCloudComputerFileName('..\\downloads;\r\n"final".zip'),
    "..-downloads-final-.zip"
  );
  assert.equal(sanitizeCloudComputerFileName("\u0000\r\n"), "artifact");
});

test("sanitizeCloudComputerPathSegment removes traversal and unsafe separators", () => {
  assert.equal(
    sanitizeCloudComputerPathSegment("../user\\nested/../../evil", "user"),
    "user-nested-evil"
  );
  assert.equal(sanitizeCloudComputerPathSegment("\u0000\r\n", "session"), "session");
});

test("buildCloudComputerArtifactStoragePath creates safe Firebase object names", () => {
  assert.equal(
    buildCloudComputerArtifactStoragePath({
      userId: "../user\\id",
      sessionId: "session/../../id",
      artifactId: "artifact/one",
      fileName: 'report;\r\n"Q1".pdf',
      timestamp: 4567.8,
    }),
    "cloud-computer/user-id/session-id/4567-artifact-one-report-Q1-.pdf"
  );
});

test("formatCloudComputerContentDisposition quotes sanitized filenames", () => {
  assert.equal(
    formatCloudComputerContentDisposition("attachment", 'file";\r\nname.csv'),
    'attachment; filename="file-name.csv"'
  );
});
