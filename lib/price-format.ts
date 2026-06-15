// lib/price-format.ts
// Utility for consistent price formatting across the app

function normSymbol(symbol: string): string {
  return (symbol || "")
    .trim()
    .toUpperCase()
    .replaceAll("/", "")
    .replaceAll("-", "")
    .replaceAll("_", "")
    .replaceAll(" ", "")
}

// Decimals overrides for specific instruments
const SYMBOL_DECIMALS: Record<string, number> = {
  // JPY pairs (broker umum: 3 digit, contoh 150.123)
  USDJPY: 3,
  EURJPY: 3,
  GBPJPY: 3,
  AUDJPY: 3,
  NZDJPY: 3,
  CADJPY: 3,
  CHFJPY: 3,

  // Metals
  XAUUSD: 2,
  XAGUSD: 2,

  // Indices (varies by broker)
  US30: 1,
  US500: 1,
  NAS100: 1,

  // Crypto common
  BTCUSD: 2,
  BTCUSDT: 2,
  ETHUSD: 2,
  ETHUSDT: 2,
}

// Heuristics for crypto decimals if not explicitly mapped
function cryptoDecimals(base: string): number {
  // kamu bisa adjust sesuai preferensi
  if (base === "BTC") return 2
  if (base === "ETH") return 2
  if (base === "BNB") return 2
  if (base === "SOL") return 2
  if (base === "XRP") return 4
  if (base === "ADA") return 4
  if (base === "DOGE") return 5
  if (base === "SHIB") return 8
  return 4 // default crypto lain
}

function isJPYPair(sym: string) {
  return sym.endsWith("JPY") && sym.length === 6
}

function isFXPair(sym: string) {
  return /^[A-Z]{6}$/.test(sym)
}

function isCryptoPair(sym: string) {
  // handle BTCUSD, BTCUSDT, ETHUSD, ETHUSDT, dll
  return /^(BTC|ETH|BNB|SOL|XRP|ADA|DOGE|SHIB)[A-Z]{3,5}$/.test(sym)
}

export function getDecimals(symbol: string): number {
  const s = normSymbol(symbol)

  // exact override first
  if (SYMBOL_DECIMALS[s] !== undefined) return SYMBOL_DECIMALS[s]

  // JPY pairs
  if (isJPYPair(s)) return 3

  // Metals
  if (s === "XAUUSD" || s === "XAGUSD") return 2

  // Indices
  if (s === "US30" || s === "US500" || s === "NAS100") return 1

  // Crypto heuristics
  if (isCryptoPair(s)) {
    const base = s.slice(0, 3) // BTC/ETH/BNB/SOL etc (SOL 3)
    return cryptoDecimals(base)
  }

  // FX default: 5 digit (EURUSD 1.12345)
  if (isFXPair(s)) return 5

  // fallback safe
  return 5
}

export function formatPrice(price: number, symbol: string): string {
  if (!Number.isFinite(price)) return "-"
  const decimals = getDecimals(symbol)
  return price.toFixed(decimals)
}

export function getConfidenceLevel(confidence: number): {
  label: string
  color: string
  bgColor: string
} {
  const percentage = confidence * 100

  if (percentage >= 75) {
    return {
      label: "High",
      color: "text-green-600",
      bgColor: "bg-green-500/10 border-green-500/20",
    }
  } else if (percentage >= 50) {
    return {
      label: "Medium",
      color: "text-yellow-600",
      bgColor: "bg-yellow-500/10 border-yellow-500/20",
    }
  } else {
    return {
      label: "Low",
      color: "text-red-600",
      bgColor: "bg-red-500/10 border-red-500/20",
    }
  }
}

export function formatLevelsForCopy(
  symbol: string,
  bias: string,
  entryPrice: number,
  stopLoss: number,
  tp1: number,
  tp2: number,
): string {
  const decimals = getDecimals(symbol)
  const f = (n: number) => (Number.isFinite(n) ? n.toFixed(decimals) : "-")

  return `${symbol} ${bias}
Entry: ${f(entryPrice)}
SL: ${f(stopLoss)}
TP1: ${f(tp1)}
TP2: ${f(tp2)}`
}