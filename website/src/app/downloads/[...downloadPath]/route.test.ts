import assert from "node:assert/strict";
import test from "node:test";

import { GET } from "./route";

function makeContext(downloadPath: string[]) {
  return { params: Promise.resolve({ downloadPath }) };
}

function makeRequest(pathname: string) {
  return new Request(`https://www.rearvy.com${pathname}`);
}

test("downloads route serves latest updater metadata", async () => {
  const response = await GET(
    makeRequest("/downloads/latest.yml"),
    makeContext(["latest.yml"])
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") || "", /ya?ml/i);
  assert.match(await response.text(), /version:\s*0\.1\.9/);
});

test("downloads route serves blockmap files", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-x64.exe.blockmap"),
    makeContext(["RearvyUserSetup-x64.exe.blockmap"])
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal((await response.arrayBuffer()).byteLength > 0, true);
});

test("downloads route redirects installer files to GitHub releases", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-x64.exe"),
    makeContext(["RearvyUserSetup-x64.exe"])
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/latest/download/RearvyUserSetup-x64.exe"
  );
});

test("downloads route redirects versioned installer files to the matching release", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-x64-0.1.9.exe"),
    makeContext(["RearvyUserSetup-x64-0.1.9.exe"])
  );

  assert.equal(response.status, 302);
  assert.equal(
    response.headers.get("location"),
    "https://github.com/mutalvita-cyber/rearvy-desktop-releases/releases/download/v0.1.9/RearvyUserSetup-x64-0.1.9.exe"
  );
});

test("downloads route rejects unknown installer files", async () => {
  const response = await GET(
    makeRequest("/downloads/RearvyUserSetup-arm64.exe"),
    makeContext(["RearvyUserSetup-arm64.exe"])
  );

  assert.equal(response.status, 404);
});

test("downloads route rejects nested local file paths", async () => {
  const response = await GET(
    makeRequest("/downloads/../latest.yml"),
    makeContext(["..", "latest.yml"])
  );

  assert.equal(response.status, 404);
});
