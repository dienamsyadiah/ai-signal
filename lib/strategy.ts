// lib/strategy.ts
import type { TechnicalSummary } from "@/lib/indicators"
import type { MarketType } from "@/lib/probability"

/**
 * Strategy plan generator:
 * - Actionable: trigger, entry, SL, TP, invalidation
 * - Menggunakan support/resistance + ATR buffer
 */
export function buildStrategyPlan(
  tech: TechnicalSummary,
  marketType: MarketType,
  formatPrice: (n: number) => string,
) {
  const support = tech.supportLevels?.length ? tech.supportLevels[0] : tech.support
  const resistance = tech.resistanceLevels?.length ? tech.resistanceLevels[0] : tech.resistance

  const support2 = tech.supportLevels?.length > 1 ? tech.supportLevels[1] : undefined
  const resistance2 = tech.resistanceLevels?.length > 1 ? tech.resistanceLevels[1] : undefined

  // Buffer berdasarkan ATR agar tidak “kepancing” noise
  const atr = tech.atrValue || 0
  const bufferMult = marketType === "crypto" ? 0.20 : 0.15
  const buffer = Math.max(atr * bufferMult, tech.lastClose * (marketType === "crypto" ? 0.0005 : 0.0002))

  const breakAbove = resistance + buffer
  const breakBelow = support - buffer

  const tpDist = Math.max(atr * (marketType === "crypto" ? 1.4 : 1.2), buffer * 2)
  const slDist = Math.max(atr * (marketType === "crypto" ? 1.0 : 0.9), buffer * 1.5)

  const bullishTP1 = breakAbove + tpDist
  const bullishTP2 = breakAbove + tpDist * 1.6
  const bullishSL = breakAbove - slDist

  const bearishTP1 = breakBelow - tpDist
  const bearishTP2 = breakBelow - tpDist * 1.6
  const bearishSL = breakBelow + slDist

  const notes: string[] = []
  notes.push(`Buffer dipakai untuk konfirmasi: ±${formatPrice(buffer)} (berbasis ATR).`)
  notes.push("Gunakan candle close (bukan wick) untuk validasi breakout/breakdown pada M5/M15.")

  return {
    keyLevels: {
      support,
      resistance,
      ...(support2 ? { support2 } : {}),
      ...(resistance2 ? { resistance2 } : {}),
    },
    bullish: {
      title: "Skenario Bullish (Breakout)",
      trigger: `BUY hanya jika harga menembus & candle close di atas resistance ${formatPrice(resistance)} (konfirmasi ≥ ${formatPrice(breakAbove)}).`,
      entry: `Entry BUY setelah close konfirmasi, idealnya retest area ${formatPrice(resistance)}–${formatPrice(breakAbove)}.`,
      stopLoss: `Stop loss di bawah level konfirmasi (≈ ${formatPrice(bullishSL)}).`,
      takeProfit: `TP1 ≈ ${formatPrice(bullishTP1)}, TP2 ≈ ${formatPrice(bullishTP2)}.`,
      invalidation: `Invalid jika breakout gagal dan harga kembali close di bawah ${formatPrice(resistance)}.`,
    },
    bearish: {
      title: "Skenario Bearish (Breakdown)",
      trigger: `SELL hanya jika harga breakdown & candle close di bawah support ${formatPrice(support)} (konfirmasi ≤ ${formatPrice(breakBelow)}).`,
      entry: `Entry SELL setelah close konfirmasi, idealnya retest area ${formatPrice(breakBelow)}–${formatPrice(support)}.`,
      stopLoss: `Stop loss di atas level konfirmasi (≈ ${formatPrice(bearishSL)}).`,
      takeProfit: `TP1 ≈ ${formatPrice(bearishTP1)}, TP2 ≈ ${formatPrice(bearishTP2)}.`,
      invalidation: `Invalid jika breakdown gagal dan harga kembali close di atas ${formatPrice(support)}.`,
    },
    notes,
  }
}