const ETH_DECIMALS = 18;
const ZERO_WEI = BigInt(0);
const WEI_PER_ETH = BigInt(10) ** BigInt(ETH_DECIMALS);
const ETH_ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;
const TX_HASH_RE = /^0x[a-fA-F0-9]{64}$/;
const HEX_CHAIN_ID_RE = /^0x[0-9a-fA-F]+$/;

export type NativeTransferValidationInput = {
  toAddress: unknown;
  amountEth: unknown;
  fromAddress?: unknown;
  chainId?: unknown;
  forbiddenFields?: Record<string, unknown>;
};

export type NativeTransferValidationResult = {
  ok: true;
  toAddress: string;
  fromAddress: string | null;
  chainId: string | null;
  amountEth: string;
  amountWei: string;
} | {
  ok: false;
  errors: string[];
};

export type TransactionLimitInput = {
  amountEth: string;
  transactionLimitEur?: number | null;
  walletEthBalance?: number | null;
  walletEurBalance?: number | null;
};

export function normalizeEthAddress(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return ETH_ADDRESS_RE.test(trimmed) ? trimmed.toLowerCase() : null;
}

export function normalizeChainId(value: unknown) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return `0x${value.toString(16)}`;
  }

  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  if (/^\d+$/.test(trimmed)) {
    const parsed = Number.parseInt(trimmed, 10);
    return parsed > 0 ? `0x${parsed.toString(16)}` : null;
  }

  return HEX_CHAIN_ID_RE.test(trimmed) ? trimmed : null;
}

export function isValidTransactionHash(value: unknown) {
  return typeof value === "string" && TX_HASH_RE.test(value.trim());
}

export function decimalEthToWei(value: unknown) {
  if (typeof value !== "string" && typeof value !== "number") {
    throw new Error("Amount is required.");
  }

  const normalized = String(value).trim().replace(/,/g, "");
  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    throw new Error("Amount must be a positive decimal number.");
  }

  const [wholeRaw, fractionalRaw = ""] = normalized.split(".");
  if (fractionalRaw.length > ETH_DECIMALS) {
    throw new Error("Native transfer amount supports at most 18 decimals.");
  }

  const wholeWei = BigInt(wholeRaw || "0") * WEI_PER_ETH;
  const fractionalWei = BigInt((fractionalRaw || "").padEnd(ETH_DECIMALS, "0") || "0");
  const totalWei = wholeWei + fractionalWei;

  if (totalWei <= ZERO_WEI) {
    throw new Error("Amount must be greater than zero.");
  }

  return totalWei.toString();
}

export function weiDecimalToHex(wei: string) {
  if (!/^\d+$/.test(wei)) {
    throw new Error("Wei value must be a decimal string.");
  }

  const value = BigInt(wei);
  if (value <= ZERO_WEI) {
    throw new Error("Wei value must be greater than zero.");
  }

  return `0x${value.toString(16)}`;
}

function normalizeAmountEth(value: unknown) {
  const normalized = String(value).trim().replace(/,/g, "");
  const wei = decimalEthToWei(normalized);
  const [whole, fractional = ""] = normalized.split(".");
  const trimmedFractional = fractional.replace(/0+$/, "");
  const amountEth = trimmedFractional ? `${whole}.${trimmedFractional}` : whole;

  return { amountEth, amountWei: wei };
}

function hasForbiddenTransactionFields(value: Record<string, unknown> | undefined) {
  if (!value) {
    return false;
  }

  return [
    "data",
    "calldata",
    "tokenAddress",
    "token_address",
    "contractAddress",
    "contract_address",
    "abi",
    "method",
    "functionName",
    "args",
  ].some((key) => value[key] !== undefined && value[key] !== null && value[key] !== "");
}

export function validateNativeTransferInput(
  input: NativeTransferValidationInput
): NativeTransferValidationResult {
  const errors: string[] = [];
  const toAddress = normalizeEthAddress(input.toAddress);
  const fromAddress = input.fromAddress ? normalizeEthAddress(input.fromAddress) : null;
  const chainId = input.chainId ? normalizeChainId(input.chainId) : null;

  if (!toAddress) {
    errors.push("A valid EVM recipient address is required.");
  }

  if (input.fromAddress && !fromAddress) {
    errors.push("Connected MetaMask address is invalid.");
  }

  if (input.chainId && !chainId) {
    errors.push("Connected chain id is invalid.");
  }

  if (hasForbiddenTransactionFields(input.forbiddenFields)) {
    errors.push("Only native EVM transfers are supported. Contract calldata and token transfers are blocked.");
  }

  let amountEth = "";
  let amountWei = "";
  try {
    const amount = normalizeAmountEth(input.amountEth);
    amountEth = amount.amountEth;
    amountWei = amount.amountWei;
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Invalid amount.");
  }

  if (errors.length > 0 || !toAddress || !amountEth || !amountWei) {
    return { ok: false, errors };
  }

  return {
    ok: true,
    toAddress,
    fromAddress,
    chainId,
    amountEth,
    amountWei,
  };
}

export function validateTransactionLimit(input: TransactionLimitInput) {
  const limit = input.transactionLimitEur;
  if (typeof limit !== "number" || !Number.isFinite(limit) || limit <= 0) {
    return { ok: true, estimatedEur: null };
  }

  const walletEth = input.walletEthBalance;
  const walletEur = input.walletEurBalance;
  if (
    typeof walletEth !== "number" ||
    typeof walletEur !== "number" ||
    !Number.isFinite(walletEth) ||
    !Number.isFinite(walletEur) ||
    walletEth <= 0 ||
    walletEur <= 0
  ) {
    return {
      ok: false,
      estimatedEur: null,
      reason: "Wallet EUR estimate is unavailable, so the transaction limit cannot be verified.",
    };
  }

  const amount = Number(input.amountEth);
  const estimatedEur = amount * (walletEur / walletEth);
  if (!Number.isFinite(estimatedEur)) {
    return {
      ok: false,
      estimatedEur: null,
      reason: "Unable to estimate transaction value.",
    };
  }

  if (estimatedEur > limit) {
    return {
      ok: false,
      estimatedEur,
      reason: "Transaction exceeds the optional MetaMask transaction limit.",
    };
  }

  return { ok: true, estimatedEur };
}
