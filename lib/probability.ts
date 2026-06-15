// lib/probability.ts
import type { TechnicalSummary } from "@/lib/indicators"

export type MarketType = "crypto" | "forex" | "metal"

export type ProbabilityResult = {
  buy: number // 0..1
  sell: number // 0..1
  wait: number // 0..1
  explanation: string[]
}

/**
 * Deterministic probability scoring:
 * - Bukan "ramalan" AI
 * - Ini estimasi berbasis konfirmasi indikator + tren + pola candle + volatility guard
 */
export function calculateSignalProbabilities(tech: TechnicalSummary, marketType: MarketType): ProbabilityResult {
  const exp: string[] = []

  // --- Helpers
  const clamp01 = (x: number) => Math.max(0, Math.min(1, x))

  const add = (arr: number[], v: number) => arr.push(v)

  // --- Weights tuned per market
  // Forex/metal biasanya lebih "mean-reverting" pada M5/M15, crypto lebih trending dan volatile
  const wTrend = marketType === "crypto" ? 1.2 : 1.0
  const wMomentum = marketType === "crypto" ? 1.0 : 0.9
  const wRSI = marketType === "crypto" ? 0.9 : 1.0
  const wBB = 0.7
  const wPattern = 0.8
  const wVolume = 0.5
  const wATRGuard = 0.7

  let buyScore = 0
  let sellScore = 0
  let waitScore = 0.15 // baseline wait

  // --- Trend bias
  if (tech.trend === "up") {
    buyScore += 0.28 * wTrend
    exp.push("Trend up menambah bias BUY.")
  } else if (tech.trend === "down") {
    sellScore += 0.28 * wTrend
    exp.push("Trend down menambah bias SELL.")
  } else {
    waitScore += 0.18
    exp.push("Trend sideways → peluang WAIT lebih tinggi.")
  }

  // --- Trend strength
  if (tech.trendStrength === "strong") {
    if (tech.trend === "up") buyScore += 0.12
    if (tech.trend === "down") sellScore += 0.12
    exp.push("Trend strength strong → konfirmasi arah lebih kuat.")
  } else if (tech.trendStrength === "moderate") {
    if (tech.trend === "up") buyScore += 0.07
    if (tech.trend === "down") sellScore += 0.07
    exp.push("Trend strength moderate → ada konfirmasi, tapi tidak maksimal.")
  } else {
    waitScore += 0.06
    exp.push("Trend strength weak → sinyal cenderung lemah (WAIT naik).")
  }

  // --- Price vs EMA12 (momentum)
  if (tech.lastClose > tech.ema12) {
    buyScore += 0.12 * wMomentum
    exp.push("Harga di atas EMA12 → momentum bullish.")
  } else if (tech.lastClose < tech.ema12) {
    sellScore += 0.12 * wMomentum
    exp.push("Harga di bawah EMA12 → momentum bearish.")
  } else {
    waitScore += 0.04
    exp.push("Harga dekat EMA12 → momentum tidak jelas.")
  }

  // --- MACD histogram sign
  if (tech.macdHistogram > 0) {
    buyScore += 0.10 * wMomentum
    exp.push("MACD histogram positif → dorongan bullish.")
  } else if (tech.macdHistogram < 0) {
    sellScore += 0.10 * wMomentum
    exp.push("MACD histogram negatif → dorongan bearish.")
  } else {
    waitScore += 0.03
    exp.push("MACD histogram netral → dorongan lemah.")
  }

  // --- RSI zones (threshold sedikit beda)
  const rsi = tech.rsiValue
  const rsiOverbought = marketType === "crypto" ? 72 : 70
  const rsiOversold = marketType === "crypto" ? 28 : 30

  if (rsi >= rsiOverbought) {
    // overbought cenderung risk untuk BUY
    sellScore += 0.07 * wRSI
    waitScore += 0.05
    exp.push(`RSI tinggi (${rsi.toFixed(0)}) → potensi pullback / SELL lebih masuk akal.`)
  } else if (rsi <= rsiOversold) {
    buyScore += 0.07 * wRSI
    waitScore += 0.05
    exp.push(`RSI rendah (${rsi.toFixed(0)}) → potensi rebound / BUY lebih masuk akal.`)
  } else if (rsi >= 45 && rsi <= 55) {
    waitScore += 0.10
    exp.push("RSI area netral (45–55) → sinyal lemah (WAIT naik).")
  } else if (rsi > 55) {
    buyScore += 0.04 * wRSI
    exp.push("RSI condong bullish (>55).")
  } else if (rsi < 45) {
    sellScore += 0.04 * wRSI
    exp.push("RSI condong bearish (<45).")
  }

  // --- Bollinger position (mean reversion / breakout hint)
  if (tech.lastClose >= tech.bollingerUpper) {
    // potensi overextension → sell / wait
    sellScore += 0.06 * wBB
    waitScore += 0.05 * wBB
    exp.push("Harga menyentuh/di atas Bollinger Upper → risiko pullback (SELL/WAIT naik).")
  } else if (tech.lastClose <= tech.bollingerLower) {
    buyScore += 0.06 * wBB
    waitScore += 0.05 * wBB
    exp.push("Harga menyentuh/di bawah Bollinger Lower → potensi rebound (BUY/WAIT naik).")
  }

  // --- Candlestick patterns
  const p = tech.candlestickPatterns
  if (p.bullishEngulfing) {
    buyScore += 0.10 * wPattern
    exp.push("Bullish engulfing terdeteksi → konfirmasi BUY.")
  }
  if (p.bearishEngulfing) {
    sellScore += 0.10 * wPattern
    exp.push("Bearish engulfing terdeteksi → konfirmasi SELL.")
  }
  if (p.hammer) {
    buyScore += 0.06 * wPattern
    exp.push("Hammer terdeteksi → potensi reversal bullish.")
  }
  if (p.shootingStar) {
    sellScore += 0.06 * wPattern
    exp.push("Shooting star terdeteksi → potensi reversal bearish.")
  }
  if (p.doji) {
    waitScore += 0.07
    exp.push("Doji terdeteksi → indecision (WAIT naik).")
  }

  // --- Volume trend
  if (tech.volumeProfile.volumeTrend === "increasing") {
    // meningkatkan validitas pergerakan arah tren
    if (tech.trend === "up") buyScore += 0.05 * wVolume
    if (tech.trend === "down") sellScore += 0.05 * wVolume
    exp.push("Volume meningkat → pergerakan lebih tervalidasi.")
  } else if (tech.volumeProfile.volumeTrend === "decreasing") {
    waitScore += 0.05
    exp.push("Volume menurun → konfirmasi melemah (WAIT naik).")
  }

  // --- ATR guard (kalau volatilitas ekstrem, WAIT naik)
  // atr% ~ atr / price
  const atrPct = tech.lastClose > 0 ? tech.atrValue / tech.lastClose : 0
  const atrHigh = marketType === "crypto" ? 0.012 : 0.006 // crypto lebih volatile
  if (atrPct >= atrHigh) {
    waitScore += 0.12 * wATRGuard
    buyScore *= 0.92
    sellScore *= 0.92
    exp.push("Volatilitas tinggi (ATR%) → risiko noise, WAIT naik.")
  }

  // --- Convert scores -> probabilities
  // Ensure non-negative
  buyScore = Math.max(0, buyScore)
  sellScore = Math.max(0, sellScore)
  waitScore = Math.max(0, waitScore)

  const sum = buyScore + sellScore + waitScore
  if (sum <= 0) {
    return { buy: 0.33, sell: 0.33, wait: 0.34, explanation: ["Data indikator lemah → probabilitas dibagi rata."] }
  }

  const buy = clamp01(buyScore / sum)
  const sell = clamp01(sellScore / sum)
  const wait = clamp01(waitScore / sum)

  return {
    buy,
    sell,
    wait,
    explanation: exp.slice(0, 10),
  }
}