// lib/indicators.ts
// Improved: safer math, aligned outputs, optional volume support
// FIXED: nearest support/resistance selection (not farthest), consistent sorting, stronger trendStrength gating

import type { Candle } from "./market-data"

type MaybeNumber = number | null

function isFiniteNumber(n: any): n is number {
  return typeof n === "number" && Number.isFinite(n)
}

function lastDefined(arr: MaybeNumber[], fallback: number): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    const v = arr[i]
    if (v != null && Number.isFinite(v)) return v
  }
  return fallback
}

/**
 * SMA padded (length === prices.length)
 */
export function calculateSMA(prices: number[], period: number): MaybeNumber[] {
  const out: MaybeNumber[] = Array(prices.length).fill(null)
  if (period <= 0 || prices.length < period) return out

  let sum = 0
  for (let i = 0; i < prices.length; i++) {
    sum += prices[i]
    if (i >= period) sum -= prices[i - period]
    if (i >= period - 1) out[i] = sum / period
  }
  return out
}

/**
 * EMA padded (length === prices.length)
 * Seeded by SMA at index period-1
 */
export function calculateEMA(prices: number[], period: number): MaybeNumber[] {
  const out: MaybeNumber[] = Array(prices.length).fill(null)
  if (period <= 0 || prices.length < period) return out

  let sum = 0
  for (let i = 0; i < period; i++) sum += prices[i]
  let ema = sum / period
  out[period - 1] = ema

  const k = 2 / (period + 1)
  for (let i = period; i < prices.length; i++) {
    ema = (prices[i] - ema) * k + ema
    out[i] = ema
  }
  return out
}

/**
 * RSI (Wilder) padded, safe from NaN/Infinity
 */
export function calculateRSI(prices: number[], period = 14): MaybeNumber[] {
  const out: MaybeNumber[] = Array(prices.length).fill(null)
  if (period <= 0 || prices.length < period + 1) return out

  let gains = 0
  let losses = 0

  for (let i = 1; i <= period; i++) {
    const change = prices[i] - prices[i - 1]
    if (change > 0) gains += change
    else losses += -change
  }

  let avgGain = gains / period
  let avgLoss = losses / period

  out[period] = rsiFromAvg(avgGain, avgLoss)

  for (let i = period + 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0

    avgGain = (avgGain * (period - 1) + gain) / period
    avgLoss = (avgLoss * (period - 1) + loss) / period

    out[i] = rsiFromAvg(avgGain, avgLoss)
  }

  return out
}

function rsiFromAvg(avgGain: number, avgLoss: number): number {
  if (avgLoss === 0) return 100
  if (avgGain === 0) return 0
  const rs = avgGain / avgLoss
  return 100 - 100 / (1 + rs)
}

/**
 * ATR (Wilder) aligned to candles length
 */
export function calculateATR(candles: Candle[], period = 14): MaybeNumber[] {
  const out: MaybeNumber[] = Array(candles.length).fill(null)
  if (period <= 0 || candles.length < period + 1) return out

  const tr: MaybeNumber[] = Array(candles.length).fill(null)
  for (let i = 1; i < candles.length; i++) {
    const high = candles[i].high
    const low = candles[i].low
    const prevClose = candles[i - 1].close
    tr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose))
  }

  let sum = 0
  for (let i = 1; i <= period; i++) sum += (tr[i] ?? 0)
  let atr = sum / period
  out[period] = atr

  for (let i = period + 1; i < candles.length; i++) {
    const trv = tr[i] ?? 0
    atr = (atr * (period - 1) + trv) / period
    out[i] = atr
  }

  return out
}

/**
 * MACD aligned to prices length
 */
export function calculateMACD(
  prices: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: MaybeNumber[]; signal: MaybeNumber[]; histogram: MaybeNumber[] } {
  const fast = calculateEMA(prices, fastPeriod)
  const slow = calculateEMA(prices, slowPeriod)

  const macd: MaybeNumber[] = Array(prices.length).fill(null)
  for (let i = 0; i < prices.length; i++) {
    if (fast[i] == null || slow[i] == null) continue
    macd[i] = (fast[i] as number) - (slow[i] as number)
  }

  const signal: MaybeNumber[] = Array(prices.length).fill(null)
  const hist: MaybeNumber[] = Array(prices.length).fill(null)

  const macdVals: number[] = []
  const macdIdx: number[] = []
  for (let i = 0; i < macd.length; i++) {
    const v = macd[i]
    if (v != null && isFiniteNumber(v)) {
      macdVals.push(v)
      macdIdx.push(i)
    }
  }

  if (macdVals.length >= signalPeriod) {
    const sigNoPad = emaNoPad(macdVals, signalPeriod)
    for (let j = 0; j < sigNoPad.length; j++) {
      const s = sigNoPad[j]
      if (!Number.isFinite(s)) continue
      const idx = macdIdx[j]
      signal[idx] = s
      if (macd[idx] != null) hist[idx] = (macd[idx] as number) - s
    }
  }

  return { macd, signal, histogram: hist }
}

function emaNoPad(values: number[], period: number): number[] {
  const out: number[] = Array(values.length).fill(NaN)
  if (values.length < period) return out

  let sum = 0
  for (let i = 0; i < period; i++) sum += values[i]
  let ema = sum / period
  out[period - 1] = ema

  const k = 2 / (period + 1)
  for (let i = period; i < values.length; i++) {
    ema = (values[i] - ema) * k + ema
    out[i] = ema
  }
  return out
}

/**
 * Bollinger aligned to prices length
 */
export function calculateBollingerBands(
  prices: number[],
  period = 20,
  stdDev = 2,
): { upper: MaybeNumber[]; middle: MaybeNumber[]; lower: MaybeNumber[] } {
  const middle = calculateSMA(prices, period)
  const upper: MaybeNumber[] = Array(prices.length).fill(null)
  const lower: MaybeNumber[] = Array(prices.length).fill(null)
  if (prices.length < period) return { upper, middle, lower }

  for (let i = period - 1; i < prices.length; i++) {
    const mean = middle[i]
    if (mean == null) continue
    const slice = prices.slice(i - period + 1, i + 1)
    const variance = slice.reduce((sum, v) => sum + (v - (mean as number)) ** 2, 0) / period
    const std = Math.sqrt(variance)
    upper[i] = (mean as number) + stdDev * std
    lower[i] = (mean as number) - stdDev * std
  }

  return { upper, middle, lower }
}

/**
 * Trend detection (adaptive threshold using ATR)
 */
export function determineTrendAdaptive(
  lastClose: number,
  sma20: number,
  sma50: number,
  atr?: number | null,
): "up" | "down" | "sideways" {
  const base = 0.0015 // 0.15%
  const atrPart = atr && atr > 0 ? (atr / lastClose) * 0.5 : 0
  const threshold = base + atrPart

  const diff = Math.abs(sma20 - sma50) / (sma50 || 1)

  if (lastClose > sma20 && sma20 > sma50) {
    if (diff < threshold) return "sideways"
    return "up"
  }
  if (lastClose < sma20 && sma20 < sma50) {
    if (diff < threshold) return "sideways"
    return "down"
  }
  return "sideways"
}

export function findSwingHigh(candles: Candle[], lookback = 20): number {
  const recent = candles.slice(-lookback)
  return Math.max(...recent.map((c) => c.high))
}

export function findSwingLow(candles: Candle[], lookback = 20): number {
  const recent = candles.slice(-lookback)
  return Math.min(...recent.map((c) => c.low))
}

function dedupeLevels(levels: number[], tolerancePct: number) {
  const out: number[] = []
  for (const lvl of levels.sort((a, b) => a - b)) {
    if (out.length === 0) {
      out.push(lvl)
      continue
    }
    const prev = out[out.length - 1]
    const tol = prev * tolerancePct
    if (Math.abs(lvl - prev) > tol) out.push(lvl)
  }
  return out
}

/**
 * ✅ Support levels:
 * - return ASC (low -> high)
 * - later we will pick nearest-below-price
 */
export function findMultipleSupportLevels(candles: Candle[], count = 3): number[] {
  const lookbacks = [10, 20, 50].map((n) => Math.min(n, candles.length))
  const raw = lookbacks.map((lb) => findSwingLow(candles, lb))
  const supports = dedupeLevels(raw, 0.0005) // 0.05%
  return supports.sort((a, b) => a - b).slice(0, count)
}

/**
 * ✅ Resistance levels:
 * - return ASC (low -> high)  <-- FIX (was DESC)
 * - later we will pick nearest-above-price
 */
export function findMultipleResistanceLevels(candles: Candle[], count = 3): number[] {
  const lookbacks = [10, 20, 50].map((n) => Math.min(n, candles.length))
  const raw = lookbacks.map((lb) => findSwingHigh(candles, lb))
  const resist = dedupeLevels(raw, 0.0005)
  return resist.sort((a, b) => a - b).slice(0, count)
}

/**
 * ✅ Pick nearest support/resistance around price
 */
function pickNearestSR(price: number, supportsAsc: number[], resistAsc: number[]) {
  const supports = supportsAsc.filter((x) => Number.isFinite(x))
  const resistances = resistAsc.filter((x) => Number.isFinite(x))

  // nearest support below price
  const support = [...supports].filter((x) => x < price).pop() ?? supports[supports.length - 1] ?? price
  // nearest resistance above price
  const resistance = resistances.find((x) => x > price) ?? resistances[0] ?? price

  const support2 = [...supports].filter((x) => x < support).pop()
  const resistance2 = resistances.find((x) => x > resistance)

  return { support, resistance, support2, resistance2 }
}

/**
 * Volume profile (safe: works even if volume missing)
 */
export function calculateVolumeProfile(candles: Candle[]): {
  avgVolume: number
  volumeTrend: "increasing" | "decreasing" | "stable"
} {
  const vols = candles
    .map((c) => c.volume)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v))

  if (vols.length === 0) return { avgVolume: 0, volumeTrend: "stable" }

  const avgVolume = vols.reduce((a, b) => a + b, 0) / vols.length
  const recentCount = Math.min(10, vols.length)
  const recentVolume = vols.slice(-recentCount).reduce((a, b) => a + b, 0) / recentCount

  let volumeTrend: "increasing" | "decreasing" | "stable" = "stable"
  if (recentVolume > avgVolume * 1.2) volumeTrend = "increasing"
  else if (recentVolume < avgVolume * 0.8) volumeTrend = "decreasing"

  return { avgVolume, volumeTrend }
}

/**
 * Candlestick pattern detection
 */
export function detectCandlestickPatterns(candles: Candle[]): {
  bullishEngulfing: boolean
  bearishEngulfing: boolean
  doji: boolean
  hammer: boolean
  shootingStar: boolean
} {
  if (candles.length < 2) {
    return { bullishEngulfing: false, bearishEngulfing: false, doji: false, hammer: false, shootingStar: false }
  }

  const c = candles[candles.length - 1]
  const p = candles[candles.length - 2]

  const body = Math.abs(c.close - c.open)
  const range = Math.max(c.high - c.low, Number.EPSILON)
  const lowerShadow = Math.min(c.open, c.close) - c.low
  const upperShadow = c.high - Math.max(c.open, c.close)

  const bullishEngulfing = p.close < p.open && c.close > c.open && c.open <= p.close && c.close >= p.open

  const bearishEngulfing = p.close > p.open && c.close < c.open && c.open >= p.close && c.close <= p.open

  const doji = body <= range * 0.1
  const hammer = lowerShadow >= body * 2 && upperShadow <= body * 0.5 && c.close > c.open
  const shootingStar = upperShadow >= body * 2 && lowerShadow <= body * 0.5 && c.close < c.open

  return { bullishEngulfing, bearishEngulfing, doji, hammer, shootingStar }
}

/**
 * TechnicalSummary
 */
export interface TechnicalSummary {
  trend: "up" | "down" | "sideways"
  trendStrength: "strong" | "moderate" | "weak"

  lastClose: number

  sma20: number
  sma50: number
  ema12: number
  ema26: number

  rsiValue: number
  atrValue: number

  support: number
  resistance: number
  supportLevels: number[]
  resistanceLevels: number[]

  macdValue: number
  macdSignal: number
  macdHistogram: number

  bollingerUpper: number
  bollingerLower: number
  bollingerMiddle: number

  volumeProfile: { avgVolume: number; volumeTrend: "increasing" | "decreasing" | "stable" }
  candlestickPatterns: {
    bullishEngulfing: boolean
    bearishEngulfing: boolean
    doji: boolean
    hammer: boolean
    shootingStar: boolean
  }
}

export function calculateTechnicalSummary(candles: Candle[], closePrices: number[]): TechnicalSummary {
  const lastClose = closePrices[closePrices.length - 1]

  const sma20Arr = calculateSMA(closePrices, 20)
  const sma50Arr = calculateSMA(closePrices, 50)
  const ema12Arr = calculateEMA(closePrices, 12)
  const ema26Arr = calculateEMA(closePrices, 26)
  const rsiArr = calculateRSI(closePrices, 14)
  const atrArr = calculateATR(candles, 14)

  const macd = calculateMACD(closePrices, 12, 26, 9)
  const bb = calculateBollingerBands(closePrices, 20, 2)

  const sma20 = lastDefined(sma20Arr, lastClose)
  const sma50 = lastDefined(sma50Arr, lastClose)
  const ema12 = lastDefined(ema12Arr, lastClose)
  const ema26 = lastDefined(ema26Arr, lastClose)
  const rsiValue = lastDefined(rsiArr, 50)
  const atrValue = lastDefined(atrArr, 0)

  const macdValue = lastDefined(macd.macd, 0)
  const macdSignal = lastDefined(macd.signal, 0)
  const macdHistogram = lastDefined(macd.histogram, 0)

  const bollingerUpper = lastDefined(bb.upper, lastClose)
  const bollingerLower = lastDefined(bb.lower, lastClose)
  const bollingerMiddle = lastDefined(bb.middle, lastClose)

  const trend = determineTrendAdaptive(lastClose, sma20, sma50, atrValue)

  // ✅ strength: MA distance + MACD histogram magnitude (with threshold)
  let trendStrength: "strong" | "moderate" | "weak" = "weak"
  const maDist = Math.abs(sma20 - sma50) / (sma50 || 1)

  // threshold histogram: relative to ATR so small noise doesn't become "moderate"
  const macdPower = Math.abs(macdHistogram)
  const macdThreshold = atrValue > 0 ? atrValue * 0.05 : 0 // 5% ATR in price units
  const macdIsMeaningful = macdPower >= macdThreshold

  if (trend !== "sideways") {
    if (maDist > 0.01 && macdIsMeaningful) trendStrength = "strong"
    else if (maDist > 0.005 || macdIsMeaningful) trendStrength = "moderate"
  }

  // ✅ Levels: compute ASC arrays, then pick nearest SR around lastClose
  const supportLevels = findMultipleSupportLevels(candles, 3) // ASC
  const resistanceLevels = findMultipleResistanceLevels(candles, 3) // ASC (FIXED)

  const picked = pickNearestSR(lastClose, supportLevels, resistanceLevels)
  const support = picked.support
  const resistance = picked.resistance

  const volumeProfile = calculateVolumeProfile(candles)
  const candlestickPatterns = detectCandlestickPatterns(candles)

  return {
    trend,
    trendStrength,
    lastClose,
    sma20,
    sma50,
    ema12,
    ema26,
    rsiValue,
    atrValue,
    support,
    resistance,
    supportLevels,
    resistanceLevels,
    macdValue,
    macdSignal,
    macdHistogram,
    bollingerUpper,
    bollingerLower,
    bollingerMiddle,
    volumeProfile,
    candlestickPatterns,
  }
}