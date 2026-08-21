import assert from "node:assert/strict";
import test from "node:test";
import {
  decimalEthToWei,
  isValidTransactionHash,
  normalizeChainId,
  normalizeEthAddress,
  validateNativeTransferInput,
  validateTransactionLimit,
  weiDecimalToHex,
} from "./validation.ts";

const ADDRESS = "0x1111111111111111111111111111111111111111";

test("normalizes EVM addresses and chain ids", () => {
  assert.equal(normalizeEthAddress(ADDRESS.toUpperCase().replace("X", "x")), ADDRESS);
  assert.equal(normalizeChainId(1), "0x1");
  assert.equal(normalizeChainId("1"), "0x1");
  assert.equal(normalizeChainId("0x89"), "0x89");
  assert.equal(normalizeEthAddress("0x123"), null);
});

test("converts positive ETH amounts to wei and hex", () => {
  assert.equal(decimalEthToWei("1"), "1000000000000000000");
  assert.equal(decimalEthToWei("0.000000000000000001"), "1");
  assert.equal(weiDecimalToHex("1000000000000000000"), "0xde0b6b3a7640000");
  assert.throws(() => decimalEthToWei("0"), /greater than zero/);
  assert.throws(() => decimalEthToWei("0.0000000000000000001"), /18 decimals/);
});

test("validates native transfer drafts and blocks calldata", () => {
  const valid = validateNativeTransferInput({
    toAddress: ADDRESS,
    amountEth: "0.25",
    chainId: "1",
  });
  assert.equal(valid.ok, true);
  if (valid.ok) {
    assert.equal(valid.amountWei, "250000000000000000");
    assert.equal(valid.chainId, "0x1");
  }

  const withCalldata = validateNativeTransferInput({
    toAddress: ADDRESS,
    amountEth: "0.25",
    forbiddenFields: { data: "0x1234" },
  });
  assert.equal(withCalldata.ok, false);
  if (!withCalldata.ok) {
    assert.match(withCalldata.errors.join(" "), /Contract calldata/);
  }
});

test("validates transaction hashes and optional EUR transaction limits", () => {
  assert.equal(
    isValidTransactionHash(`0x${"a".repeat(64)}`),
    true
  );
  assert.equal(isValidTransactionHash("0x1234"), false);

  assert.deepEqual(
    validateTransactionLimit({
      amountEth: "0.5",
      transactionLimitEur: 1000,
      walletEthBalance: 2,
      walletEurBalance: 4000,
    }),
    { ok: true, estimatedEur: 1000 }
  );

  const exceeded = validateTransactionLimit({
    amountEth: "0.6",
    transactionLimitEur: 1000,
    walletEthBalance: 2,
    walletEurBalance: 4000,
  });
  assert.equal(exceeded.ok, false);
});
