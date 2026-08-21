import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_WINDOWS_DOWNLOAD_URL } from "@/lib/utils/download-url";
import { GET } from "./route";

const originalDownloadUrl = process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL;

test.afterEach(() => {
  if (originalDownloadUrl === undefined) {
    delete process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL;
  } else {
    process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL = originalDownloadUrl;
  }
});

function makeRequest(pathname: string) {
  return new Request(`https://www.rearvy.com${pathname}`);
}

test("install route rejects unsupported installer requests", () => {
  const response = GET(makeRequest("/install"));

  assert.equal(response.status, 400);
});

test("install route falls back when configured installer URL is invalid", async () => {
  process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL = "javascript:alert(1)";

  const response = GET(makeRequest("/install?win32=true"));
  const script = await response.text();

  assert.equal(response.status, 200);
  assert.match(script, new RegExp(DEFAULT_WINDOWS_DOWNLOAD_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(script, /javascript:alert/);
});

test("install route includes valid configured installer URLs", async () => {
  process.env.NEXT_PUBLIC_WINDOWS_DOWNLOAD_URL = "https://downloads.example.com/RearvyUserSetup-x64.exe";

  const response = GET(makeRequest("/install?win32=true"));
  const script = await response.text();

  assert.equal(response.status, 200);
  assert.match(script, /https:\/\/downloads\.example\.com\/RearvyUserSetup-x64\.exe/);
});
