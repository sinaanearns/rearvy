import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_MAC_DOWNLOAD_URL,
  DEFAULT_WINDOWS_DOWNLOAD_URL,
  resolveMacDownloadUrl,
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

test("resolveMacDownloadUrl uses the default macOS release URL when unset", () => {
  assert.equal(resolveMacDownloadUrl(""), DEFAULT_MAC_DOWNLOAD_URL);
  assert.equal(resolveMacDownloadUrl(undefined), DEFAULT_MAC_DOWNLOAD_URL);
});

test("resolveMacDownloadUrl rejects malformed or stale URLs", () => {
  assert.equal(resolveMacDownloadUrl("javascript:alert(1)"), DEFAULT_MAC_DOWNLOAD_URL);
  assert.equal(
    resolveMacDownloadUrl("https://github.com/mutalvita-cyber/rearvy2.0/releases/download/v0.1.0/Rearvy-win-x64.exe"),
    DEFAULT_MAC_DOWNLOAD_URL
  );
});

test("resolveMacDownloadUrl keeps valid http and https installer URLs", () => {
  assert.equal(
    resolveMacDownloadUrl("https://downloads.example.com/Rearvy-mac-universal.dmg"),
    "https://downloads.example.com/Rearvy-mac-universal.dmg"
  );
  assert.equal(
    resolveMacDownloadUrl("http://localhost:8080/Rearvy-mac-universal.dmg"),
    "http://localhost:8080/Rearvy-mac-universal.dmg"
  );
});
