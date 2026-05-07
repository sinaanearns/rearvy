export function normalizeTradingSymbol(symbol: string): string {
  return symbol.replace(/\s+/g, '').toUpperCase();
}

export function isForexOrMetalSymbol(symbol: string): boolean {
  return /(XAU|XAG|EUR|GBP|JPY|CHF|CAD|AUD|NZD)\/?USD|USD\/?(JPY|CHF|CAD|AUD|NZD|TRY|MXN)/i.test(
    normalizeTradingSymbol(symbol)
  );
}

function isMetalSymbol(symbol: string): boolean {
  return /(XAU|XAG)/i.test(normalizeTradingSymbol(symbol));
}

function isJpyPair(symbol: string): boolean {
  return /JPY/i.test(normalizeTradingSymbol(symbol));
}

export function getPriceFractionDigits(symbol: string | undefined, value?: number): number {
  const normalized = symbol ? normalizeTradingSymbol(symbol) : '';

  if (normalized && isForexOrMetalSymbol(normalized)) {
    if (isMetalSymbol(normalized)) return 2;
    if (isJpyPair(normalized)) return 3;
    return 5;
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    if (value >= 1000) return 2;
    if (value >= 100) return 3;
    if (value >= 1) return 4;
    if (value >= 0.1) return 5;
    return 6;
  }

  return 2;
}

export function formatTradingPrice(value: number | undefined, symbol?: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '--';
  }

  const digits = getPriceFractionDigits(symbol, value);
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}
