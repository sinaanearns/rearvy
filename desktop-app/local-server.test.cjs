const assert = require("node:assert");
const test = require("node:test");

const {
  applyPrivateNetworkCorsHeader,
  shouldAllowPrivateNetworkAccess,
  shouldAllowOrigin,
} = require("./local-server.cjs");

function createResponseStub() {
  const headers = new Map();
  return {
    headers,
    getHeader(name) {
      return headers.get(name);
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
  };
}

test("allows Rearvy production origin for desktop local API", () => {
  assert.equal(shouldAllowOrigin("https://www.rearvy.com"), true);
});

test("marks allowed private-network preflights for hosted production Maria", () => {
  const req = {
    headers: {
      origin: "https://www.rearvy.com",
      "access-control-request-private-network": " TRUE ",
    },
  };

  assert.equal(shouldAllowPrivateNetworkAccess(req), true);

  const res = createResponseStub();
  let nextCalled = false;
  applyPrivateNetworkCorsHeader(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(res.headers.get("Access-Control-Allow-Private-Network"), "true");
  assert.equal(res.headers.get("Vary"), "Access-Control-Request-Private-Network");
});

test("does not mark private-network preflights for untrusted origins", () => {
  const req = {
    headers: {
      origin: "https://evil.example",
      "access-control-request-private-network": "true",
    },
  };
  const res = createResponseStub();

  assert.equal(shouldAllowPrivateNetworkAccess(req), false);
  applyPrivateNetworkCorsHeader(req, res, () => {});
  assert.equal(res.headers.has("Access-Control-Allow-Private-Network"), false);
  assert.equal(res.headers.has("Vary"), false);
});

test("preserves existing vary headers for private-network preflights", () => {
  const req = {
    headers: {
      origin: "https://www.rearvy.com",
      "access-control-request-private-network": "true",
    },
  };
  const res = createResponseStub();
  res.setHeader("Vary", "Origin");

  applyPrivateNetworkCorsHeader(req, res, () => {});

  assert.equal(res.headers.get("Vary"), "Origin, Access-Control-Request-Private-Network");
});
