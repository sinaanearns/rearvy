import type { Firestore } from "firebase-admin/firestore";
import { COLLECTIONS } from "@/lib/firebase/schema";
import type {
  TransactionRequest,
  TransactionRequestSource,
  TransactionRequestStatus,
} from "./types";
import {
  isValidTransactionHash,
  normalizeChainId,
  normalizeEthAddress,
  validateNativeTransferInput,
} from "./validation";

export type CreateTransactionRequestInput = {
  userId: string;
  chatId?: string | null;
  projectId?: string | null;
  agentRunId?: string | null;
  source?: TransactionRequestSource;
  fromAddress?: unknown;
  toAddress: unknown;
  chainId?: unknown;
  networkName?: unknown;
  amountEth: unknown;
  reason?: string | null;
  riskSummary?: string | null;
  forbiddenFields?: Record<string, unknown>;
};

export type TransactionRequestActionInput =
  | { action: "approve"; actorUserId: string }
  | { action: "reject"; actorUserId: string; error?: string | null }
  | {
      action: "submit";
      actorUserId: string;
      txHash: unknown;
      fromAddress: unknown;
      chainId: unknown;
      walletUseApproved?: unknown;
      walletUseApprovedAt?: unknown;
    }
  | { action: "fail"; actorUserId: string; error: string };

function cleanText(value: string | null | undefined, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value.replace(/\s+/g, " ").trim();
  return cleaned ? cleaned.slice(0, maxLength) : fallback;
}

function firstString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function createTransactionRequest(
  adminDb: Firestore,
  input: CreateTransactionRequestInput
) {
  const profileSnap = await adminDb
    .collection(COLLECTIONS.PROFILES)
    .doc(input.userId)
    .get()
    .catch(() => null);
  const profile = profileSnap?.exists
    ? (profileSnap.data() as Record<string, unknown>)
    : {};
  const inferredFromAddress =
    input.fromAddress ?? firstString(profile.metamask_address);
  const inferredChainId = input.chainId ?? firstString(profile.metamask_chain_id);
  const inputNetworkName = firstString(input.networkName);
  const networkName =
    cleanText(inputNetworkName, firstString(profile.metamask_network) ?? "", 120) ||
    null;

  const validation = validateNativeTransferInput({
    toAddress: input.toAddress,
    amountEth: input.amountEth,
    fromAddress: inferredFromAddress,
    chainId: inferredChainId,
    forbiddenFields: input.forbiddenFields,
  });

  if (!validation.ok) {
    throw new Error(validation.errors.join(" "));
  }

  const nowIso = new Date().toISOString();
  const id = crypto.randomUUID();
  const request: TransactionRequest = {
    id,
    user_id: input.userId,
    chat_id: input.chatId ?? null,
    project_id: input.projectId ?? null,
    agent_run_id: input.agentRunId ?? null,
    source: input.source ?? "ai_suggestion",
    type: "native_evm_transfer",
    status: "awaiting_approval",
    from_address: validation.fromAddress,
    to_address: validation.toAddress,
    chain_id: validation.chainId,
    network_name: networkName,
    native_symbol: "ETH",
    amount_eth: validation.amountEth,
    amount_wei: validation.amountWei,
    human_amount: `${validation.amountEth} ETH`,
    amount_display: `${validation.amountEth} ETH`,
    reason: cleanText(input.reason, "Native EVM transfer requested from chat.", 1000),
    risk_summary: cleanText(
      input.riskSummary,
      "Native currency transfer. User approval and MetaMask confirmation are required before funds move.",
      1000
    ),
    approval_required: true,
    approved_at: null,
    approved_by: null,
    wallet_use_approved_at: null,
    wallet_use_approved_by: null,
    rejected_at: null,
    rejected_by: null,
    submitted_at: null,
    tx_hash: null,
    error: null,
    created_at: nowIso,
    updated_at: nowIso,
  };

  await adminDb.collection(COLLECTIONS.TRANSACTION_REQUESTS).doc(id).set(request);
  return request;
}

export async function listTransactionRequests(
  adminDb: Firestore,
  userId: string,
  options: {
    status?: TransactionRequestStatus | "open";
    limit?: number;
  } = {}
) {
  const limit = Math.min(Math.max(options.limit || 20, 1), 50);
  const snapshot = await adminDb
    .collection(COLLECTIONS.TRANSACTION_REQUESTS)
    .where("user_id", "==", userId)
    .limit(100)
    .get();

  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }) as TransactionRequest)
    .filter((request) => {
      if (!options.status) {
        return true;
      }

      if (options.status === "open") {
        return request.status === "awaiting_approval" || request.status === "approved";
      }

      return request.status === options.status;
    })
    .sort((left, right) => right.created_at.localeCompare(left.created_at))
    .slice(0, limit);
}

export async function getTransactionRequest(
  adminDb: Firestore,
  userId: string,
  requestId: string
) {
  const snapshot = await adminDb
    .collection(COLLECTIONS.TRANSACTION_REQUESTS)
    .doc(requestId)
    .get();
  const request = snapshot.exists
    ? ({ id: snapshot.id, ...snapshot.data() } as TransactionRequest)
    : null;

  if (!request || request.user_id !== userId) {
    return null;
  }

  return request;
}

export function applyTransactionRequestAction(
  request: TransactionRequest,
  input: TransactionRequestActionInput,
  nowIso = new Date().toISOString()
): TransactionRequest {
  if (input.action === "approve") {
    if (request.status !== "awaiting_approval" && request.status !== "draft") {
      throw new Error("Only draft or awaiting approval transaction requests can be approved.");
    }

    return {
      ...request,
      status: "approved",
      approved_at: nowIso,
      approved_by: input.actorUserId,
      error: null,
      updated_at: nowIso,
    };
  }

  if (input.action === "reject") {
    if (request.status === "submitted") {
      throw new Error("Submitted transaction requests cannot be rejected.");
    }

    return {
      ...request,
      status: "rejected",
      rejected_at: nowIso,
      rejected_by: input.actorUserId,
      error: cleanText(input.error, "Rejected by user.", 500),
      updated_at: nowIso,
    };
  }

  if (input.action === "submit") {
    if (request.status !== "approved") {
      throw new Error("Transaction request must be approved before submission.");
    }

    if (!request.approved_at || !request.approved_by) {
      throw new Error("Recorded user approval is required before MetaMask can be used.");
    }

    if (input.walletUseApproved !== true) {
      throw new Error("Explicit wallet-use approval is required before MetaMask can be used.");
    }

    if (!isValidTransactionHash(input.txHash)) {
      throw new Error("A valid transaction hash is required.");
    }

    const fromAddress = normalizeEthAddress(input.fromAddress);
    if (!fromAddress) {
      throw new Error("A valid sender address is required.");
    }

    if (request.from_address && request.from_address.toLowerCase() !== fromAddress.toLowerCase()) {
      throw new Error("Connected MetaMask account does not match the approved sender.");
    }

    const chainId = normalizeChainId(input.chainId);
    if (!chainId) {
      throw new Error("A valid chain id is required.");
    }

    if (request.chain_id && request.chain_id.toLowerCase() !== chainId.toLowerCase()) {
      throw new Error("Connected MetaMask chain does not match the approved chain.");
    }

    return {
      ...request,
      status: "submitted",
      from_address: fromAddress,
      chain_id: chainId,
      tx_hash: String(input.txHash).trim(),
      wallet_use_approved_at: firstString(input.walletUseApprovedAt) ?? nowIso,
      wallet_use_approved_by: input.actorUserId,
      submitted_at: nowIso,
      error: null,
      updated_at: nowIso,
    };
  }

  if (request.status === "submitted") {
    throw new Error("Submitted transaction requests cannot be marked failed.");
  }

  return {
    ...request,
    status: "failed",
    error: cleanText(input.error, "Transaction failed.", 1000),
    updated_at: nowIso,
  };
}

export async function updateTransactionRequest(
  adminDb: Firestore,
  userId: string,
  requestId: string,
  input: TransactionRequestActionInput
) {
  const request = await getTransactionRequest(adminDb, userId, requestId);
  if (!request) {
    return null;
  }

  const nextRequest = applyTransactionRequestAction(request, input);
  await adminDb
    .collection(COLLECTIONS.TRANSACTION_REQUESTS)
    .doc(requestId)
    .set(nextRequest, { merge: true });

  return nextRequest;
}
