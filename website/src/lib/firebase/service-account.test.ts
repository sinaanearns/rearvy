import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeRawEnvValue,
  parseServiceAccountEnv,
} from "./service-account";

const privateKey = "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n";

const serviceAccount = {
  project_id: "rearvy-test",
  client_email: "firebase-admin@example.com",
  private_key: privateKey,
};

test("normalizeRawEnvValue trims wrapping quotes", () => {
  assert.equal(normalizeRawEnvValue(' "value" '), "value");
  assert.equal(normalizeRawEnvValue(" 'value' "), "value");
  assert.equal(normalizeRawEnvValue(" value "), "value");
});

test("parseServiceAccountEnv parses raw and base64 service account JSON", () => {
  const expected = {
    projectId: "rearvy-test",
    clientEmail: "firebase-admin@example.com",
    privateKey: privateKey.replace(/\\n/g, "\n"),
  };

  assert.deepEqual(parseServiceAccountEnv(JSON.stringify(serviceAccount)), expected);
  assert.deepEqual(
    parseServiceAccountEnv(
      Buffer.from(JSON.stringify(serviceAccount), "utf8").toString("base64")
    ),
    expected
  );
});

test("parseServiceAccountEnv parses double-encoded service account JSON", () => {
  assert.equal(
    parseServiceAccountEnv(JSON.stringify(JSON.stringify(serviceAccount))).projectId,
    "rearvy-test"
  );
});

test("parseServiceAccountEnv accepts camelCase field names and multiline keys", () => {
  const parsed = parseServiceAccountEnv(
    JSON.stringify({
      projectId: "rearvy-test",
      clientEmail: "firebase-admin@example.com",
      privateKey: privateKey.replace(/\\n/g, "\n"),
    })
  );

  assert.equal(parsed.privateKey.includes("\nabc\n"), true);
});

test("parseServiceAccountEnv rejects malformed service accounts", () => {
  assert.throws(() => parseServiceAccountEnv("not-json"), /Service account value must be a JSON object/);
  assert.throws(
    () => parseServiceAccountEnv(JSON.stringify({ ...serviceAccount, private_key: "" })),
    /Missing or invalid private key/
  );
  assert.throws(
    () => parseServiceAccountEnv(JSON.stringify({ private_key: privateKey })),
    /Missing required fields/
  );
});
