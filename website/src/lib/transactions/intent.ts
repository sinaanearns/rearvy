import { normalizeEthAddress } from "./validation";

export type NativeTransferIntent = {
  toAddress: string;
  amountEth: string;
  reason: string;
};

const TRANSFER_VERBS = /\b(send|pay|transfer)\b/i;
const EVM_ADDRESS = /0x[a-fA-F0-9]{40}/;
const AMOUNT_WITH_NATIVE =
  /(?:^|\s)(\d+(?:[.,]\d{1,18})?)\s*(?:eth|ether|native)\b/i;

export function detectNativeTransferIntent(text: string): NativeTransferIntent | null {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (!trimmed || !TRANSFER_VERBS.test(trimmed)) {
    return null;
  }

  const addressMatch = trimmed.match(EVM_ADDRESS);
  if (!addressMatch) {
    return null;
  }

  const toAddress = normalizeEthAddress(addressMatch[0]);
  if (!toAddress) {
    return null;
  }

  const amountMatch = trimmed.match(AMOUNT_WITH_NATIVE);
  if (!amountMatch) {
    return null;
  }

  return {
    toAddress,
    amountEth: amountMatch[1].replace(",", "."),
    reason: trimmed.slice(0, 500),
  };
}

export function isUnsupportedTokenTransferIntent(text: string) {
  return (
    TRANSFER_VERBS.test(text) &&
    EVM_ADDRESS.test(text) &&
    /\b(usdc|usdt|dai|erc20|erc-20|token)\b/i.test(text)
  );
}
