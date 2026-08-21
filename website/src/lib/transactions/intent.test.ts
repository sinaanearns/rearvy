import assert from "node:assert/strict";
import test from "node:test";
import {
  detectNativeTransferIntent,
  isUnsupportedTokenTransferIntent,
} from "./intent.ts";

const ADDRESS = "0x2222222222222222222222222222222222222222";

test("detects explicit native EVM transfer wording", () => {
  assert.deepEqual(detectNativeTransferIntent(`send 0.01 ETH to ${ADDRESS}`), {
    toAddress: ADDRESS,
    amountEth: "0.01",
    reason: `send 0.01 ETH to ${ADDRESS}`,
  });

  assert.deepEqual(detectNativeTransferIntent(`pay ${ADDRESS} 1,5 ether`), {
    toAddress: ADDRESS,
    amountEth: "1.5",
    reason: `pay ${ADDRESS} 1,5 ether`,
  });
});

test("does not draft vague or token transfer intents", () => {
  assert.equal(detectNativeTransferIntent("send money tomorrow"), null);
  assert.equal(detectNativeTransferIntent(`send 20 USDC to ${ADDRESS}`), null);
  assert.equal(isUnsupportedTokenTransferIntent(`send 20 USDC to ${ADDRESS}`), true);
});
