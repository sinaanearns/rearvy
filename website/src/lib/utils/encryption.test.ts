import assert from "node:assert/strict";
import test from "node:test";
import { decrypt, encrypt, generateEncryptionKey } from "./encryption";

const originalKey = process.env.INTEGRATION_ENCRYPTION_KEY;

test.afterEach(() => {
  if (originalKey === undefined) {
    delete process.env.INTEGRATION_ENCRYPTION_KEY;
  } else {
    process.env.INTEGRATION_ENCRYPTION_KEY = originalKey;
  }
});

test("encrypt/decrypt round trips integration secrets", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = generateEncryptionKey();

  const payload = "access-token-value";
  const encrypted = encrypt(payload);

  assert.notEqual(encrypted.encrypted, payload);
  assert.equal(decrypt(encrypted.encrypted, encrypted.iv), payload);
});

test("encryption key must be a 32-byte hex string", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = "not-hex";

  assert.throws(
    () => encrypt("secret"),
    /INTEGRATION_ENCRYPTION_KEY must be a 32-byte hex string/
  );
});

test("decrypt rejects malformed encrypted payloads before crypto", () => {
  process.env.INTEGRATION_ENCRYPTION_KEY = generateEncryptionKey();

  assert.throws(
    () => decrypt("missing-auth-tag", "bad-iv"),
    /Invalid encrypted payload IV/
  );
  assert.throws(
    () => decrypt("missing-auth-tag", "00112233445566778899aabbccddeeff"),
    /Invalid encrypted payload format/
  );
});
