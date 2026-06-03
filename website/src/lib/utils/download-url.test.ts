import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_WINDOWS_DOWNLOAD_URL,
  resolveWindowsDownloadUrl,
} from "./download-url";

test("resolveWindowsDownloadUrl uses the default release URL when unset", () => {
  assert.equal(resolveWindowsDownloadUrl(""), DEFAULT_WINDOWS_DOWNLOAD_URL);
  assert.equal(resolveWindowsDownloadUrl(undefined), DEFAULT_WINDOWS_DOWNLOAD_URL);
});

test("resolveWindowsDownloadUrl rejects stale installer URLs", () => {
  assert.equal(
    resolveWindowsDownloadUrl("https://github.com/mutalvita-cyber/rearvy2.0/releases/download/v0.1.0/Rearvy-win-x64.exe"),
    DEFAULT_WINDOWS_DOWNLOAD_URL
  );
});

test("resolveWindowsDownloadUrl rejects malformed or non-http URLs", () => {
  assert.equal(resolveWindowsDownloadUrl("javascript:alert(1)"), DEFAULT_WINDOWS_DOWNLOAD_URL);
  assert.equal(resolveWindowsDownloadUrl("not a url"), DEFAULT_WINDOWS_DOWNLOAD_URL);
  assert.equal(resolveWindowsDownloadUrl("file:///C:/RearvyUserSetup-x64.exe"), DEFAULT_WINDOWS_DOWNLOAD_URL);
});

test("resolveWindowsDownloadUrl keeps valid http and https installer URLs", () => {
  assert.equal(
    resolveWindowsDownloadUrl("https://downloads.example.com/RearvyUserSetup-x64.exe"),
    "https://downloads.example.com/RearvyUserSetup-x64.exe"
  );
  assert.equal(
    resolveWindowsDownloadUrl("http://localhost:8080/RearvyUserSetup-x64.exe"),
    "http://localhost:8080/RearvyUserSetup-x64.exe"
  );
});
