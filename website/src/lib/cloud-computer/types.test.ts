import assert from "node:assert/strict";
import test from "node:test";

import type {
  CloudComputerFile,
  CloudComputerSession,
} from "@/lib/firebase/schema";
import {
  serializeCloudComputerFile,
  serializeCloudComputerSession,
} from "./types.ts";

const baseFile: CloudComputerFile = {
  id: "file-1",
  user_id: "user-1",
  session_id: "session-1",
  provider_session_id: "provider-session-1",
  filename: "download.zip",
  type: "download",
  content_type: "application/zip",
  size_bytes: 1024,
  browserbase_download_id: "download-1",
  storage_path: "cloud-computer/user/session/file.zip",
  download_url:
    "https://firebasestorage.googleapis.com/v0/b/app/o/file.zip?alt=media&token=abc",
  created_at: "2026-01-01T00:00:00.000Z",
};

const baseSession: CloudComputerSession = {
  id: "session-1",
  user_id: "user-1",
  provider: "browserbase",
  provider_session_id: "provider-session-1",
  task: "Download report",
  status: "completed",
  current_url: "https://example.com",
  title: "Example",
  summary: "Done",
  error: null,
  screenshot_storage_path: "cloud-computer/user/session/screenshot.png",
  screenshot_url:
    "https://firebasestorage.googleapis.com/v0/b/app/o/screenshot.png?alt=media&token=abc",
  ttl_seconds: 900,
  expires_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:01:00.000Z",
  started_at: "2026-01-01T00:00:00.000Z",
  stopped_at: "2026-01-01T00:01:00.000Z",
};

test("serializeCloudComputerFile keeps safe download URLs", () => {
  assert.equal(
    serializeCloudComputerFile(baseFile).downloadUrl,
    baseFile.download_url
  );
});

test("serializeCloudComputerFile sanitizes persisted filenames", () => {
  assert.equal(
    serializeCloudComputerFile({
      ...baseFile,
      filename: '..\\downloads;\r\n"final".zip',
    }).filename,
    "..-downloads-final-.zip"
  );
  assert.equal(
    serializeCloudComputerFile({
      ...baseFile,
      filename: "\u0000\r\n",
    }).filename,
    "artifact"
  );
});

test("serializeCloudComputerFile drops unsafe persisted download URLs", () => {
  assert.equal(
    serializeCloudComputerFile({
      ...baseFile,
      download_url: "https://trusted.example@evil.example/download.zip",
    }).downloadUrl,
    null
  );
  assert.equal(
    serializeCloudComputerFile({
      ...baseFile,
      download_url: "/api/internal/downloads/file.zip",
    }).downloadUrl,
    null
  );
});

test("serializeCloudComputerSession normalizes screenshot URLs", () => {
  assert.equal(
    serializeCloudComputerSession(baseSession).screenshotUrl,
    baseSession.screenshot_url
  );
  assert.equal(
    serializeCloudComputerSession({
      ...baseSession,
      screenshot_url: "javascript:alert(1)",
    }).screenshotUrl,
    null
  );
});

test("serializeCloudComputerSession normalizes current and live view URLs", () => {
  assert.equal(serializeCloudComputerSession(baseSession).currentUrl, "https://example.com/");
  assert.equal(
    serializeCloudComputerSession(
      baseSession,
      [],
      "https://browserbase.example/live-view/session"
    ).liveViewUrl,
    "https://browserbase.example/live-view/session"
  );
  assert.equal(
    serializeCloudComputerSession({
      ...baseSession,
      current_url: "chrome://settings",
    }).currentUrl,
    null
  );
  assert.equal(
    serializeCloudComputerSession(
      baseSession,
      [],
      "https://trusted.example@evil.example/live-view"
    ).liveViewUrl,
    null
  );
});
