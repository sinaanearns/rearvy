import assert from "node:assert/strict";
import test from "node:test";
import { applyTransactionRequestAction } from "./store.ts";
import type { TransactionRequest } from "./types.ts";

const BASE_REQUEST: TransactionRequest = {
  id: "tx_req_1",
  user_id: "user_1",
  chat_id: "chat_1",
  project_id: null,
  agent_run_id: null,
  source: "ai_suggestion",
  type: "native_evm_transfer",
  status: "awaiting_approval",
  from_address: "0x3333333333333333333333333333333333333333",
  to_address: "0x4444444444444444444444444444444444444444",
  chain_id: "0x1",
  network_name: "Ethereum",
  native_symbol: "ETH",
  amount_eth: "0.1",
  amount_wei: "100000000000000000",
  human_amount: "0.1 ETH",
  amount_display: "0.1 ETH",
  reason: "Test transfer",
  risk_summary: "Approval and MetaMask confirmation required.",
  approval_required: true,
  approved_at: null,
  approved_by: null,
  rejected_at: null,
  rejected_by: null,
  submitted_at: null,
  tx_hash: null,
  error: null,
  created_at: "2026-05-24T00:00:00.000Z",
  updated_at: "2026-05-24T00:00:00.000Z",
};

test("transaction requests cannot submit before approval", () => {
  assert.throws(
    () =>
      applyTransactionRequestAction(BASE_REQUEST, {
        action: "submit",
        actorUserId: "user_1",
        txHash: `0x${"a".repeat(64)}`,
        fromAddress: BASE_REQUEST.from_address,
        chainId: BASE_REQUEST.chain_id,
      }),
    /approved before submission/
  );
});

test("transaction requests approve then submit with MetaMask hash", () => {
  const approved = applyTransactionRequestAction(
    BASE_REQUEST,
    { action: "approve", actorUserId: "user_1" },
    "2026-05-24T01:00:00.000Z"
  );
  assert.equal(approved.status, "approved");
  assert.equal(approved.approved_by, "user_1");

  const submitted = applyTransactionRequestAction(
    approved,
    {
      action: "submit",
      actorUserId: "user_1",
      txHash: `0x${"b".repeat(64)}`,
      fromAddress: BASE_REQUEST.from_address,
      chainId: "1",
    },
    "2026-05-24T01:05:00.000Z"
  );

  assert.equal(submitted.status, "submitted");
  assert.equal(submitted.tx_hash, `0x${"b".repeat(64)}`);
  assert.equal(submitted.chain_id, "0x1");
});

test("transaction requests reject and block later submission", () => {
  const rejected = applyTransactionRequestAction(BASE_REQUEST, {
    action: "reject",
    actorUserId: "user_1",
    error: "No longer needed.",
  });

  assert.equal(rejected.status, "rejected");
  assert.throws(
    () =>
      applyTransactionRequestAction(rejected, {
        action: "submit",
        actorUserId: "user_1",
        txHash: `0x${"c".repeat(64)}`,
        fromAddress: BASE_REQUEST.from_address,
        chainId: BASE_REQUEST.chain_id,
      }),
    /approved before submission/
  );
});

test("transaction requests enforce sender and chain match", () => {
  const approved = applyTransactionRequestAction(BASE_REQUEST, {
    action: "approve",
    actorUserId: "user_1",
  });

  assert.throws(
    () =>
      applyTransactionRequestAction(approved, {
        action: "submit",
        actorUserId: "user_1",
        txHash: `0x${"d".repeat(64)}`,
        fromAddress: "0x5555555555555555555555555555555555555555",
        chainId: BASE_REQUEST.chain_id,
      }),
    /does not match the approved sender/
  );

  assert.throws(
    () =>
      applyTransactionRequestAction(approved, {
        action: "submit",
        actorUserId: "user_1",
        txHash: `0x${"d".repeat(64)}`,
        fromAddress: BASE_REQUEST.from_address,
        chainId: "0x89",
      }),
    /does not match the approved chain/
  );
});
