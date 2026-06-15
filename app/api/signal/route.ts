// app/api/signal/route.ts
import { type NextRequest, NextResponse } from "next/server"
import { generateObject } from "ai"
import { openai } from "@ai-sdk/openai"
import { z } from "zod"

import { fetchOHLCData, normalizeSymbol } from "@/lib/market-data"
import { calculateTechnicalSummary, type TechnicalSummary } from "@/lib/indicators"
import { signalCache, SIGNAL_CACHE_TTL } from "@/lib/cache"
import { signalRateLimiter, getClientIP } from "@/lib/rate-limit"

// ✅ NEW: probabilities + strategy plan (make sure these files exist)
import { calculateSignalProbabilities } from "@/lib/probability"
import { buildStrategyPlan } from "@/lib/strategy"

export const runtime = "nodejs"

interface SignalRequest {
  symbol: string
  timeframe: string
  style: string
  riskProfile: string
  accountSize?: number
  maxRiskPercent?: number
  forceNew?: boolean
}

const signalSchema = z.object({
  bias: z.enum(["BUY", "SELL", "WAIT"]),
  entry: z.object({
    type: z.enum(["Market", "Limit", "Stop"]),
    price: z.number(),
  }),
  stopLoss: z.number(),
  takeProfit: z.array(z.number()).min(1).max(3),
  confidence: z.number().min(0).max(1),
  rationale: z.array(z.string()).min(1).max(8),
  riskNotes: z.array(z.string()).min(1).max(8),
})

/**
 * Detect market type from symbol
 */
function detectMarketType(symbol: string): "crypto" | "forex" | "metal" {
  const raw = (symbol || "").toUpperCase().replace(/\s+/g, "")
  const s = raw.replace("/", "")
  if (s.includes("XAU") || s.includes("XAG")) return "metal"

  if (s.includes("USDT")) return "crypto"
  if (s.startsWith("BTC") || s.startsWith("ETH") || s.startsWith("SOL") || s.startsWith("BNB") || s.startsWith("XRP")) {
    return "crypto"
  }

  if (/^[A-Z]{6}$/.test(s)) return "forex"
  if (s.includes("BTC") || s.includes("ETH")) return "crypto"

  return "forex"
}

/**
 * ✅ Decimals for forex/metal/crypto
 */
function decimalsForSymbol(symbol: string) {
  const s = (symbol || "").toUpperCase().replace("/", "")
  if (s === "USDJPY") return 3
  if (s === "XAUUSD") return 2

  const type = detectMarketType(symbol)
  if (type === "crypto") {
    if (s.includes("BTC")) return 2
    if (s.includes("ETH")) return 2
    if (s.includes("BNB")) return 2
    if (s.includes("SOL") || s.includes("XRP")) return 3
    return 4
  }

  return 5
}

/**
 * ✅ Robust env check:
 * Accept TWELVE_DATA_API_KEY or TWELVEDATA_API_KEY
 */
function getTwelveDataKeyOrThrow() {
  const key = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY
  if (!key) {
    throw new Error("TWELVE_DATA_API_KEY belum diset. Tambahkan di .env.local lalu restart server.")
  }
  return key
}

/**
 * ✅ Only require TwelveData for Forex/Metal. Crypto uses Binance (no key).
 */
function envCheckOrThrowForRequest(symbol: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY belum diset. Tambahkan di .env.local lalu restart server.")
  }

  const marketType = detectMarketType(symbol)
  if (marketType === "crypto") return

  getTwelveDataKeyOrThrow()
}

function isMarketNetworkErrorMessage(message: string) {
  const m = message.toLowerCase()
  return (
    m.includes("market_network_error") ||
    m.includes("fetch failed") ||
    m.includes("getaddrinfo") ||
    m.includes("eai_again") ||
    m.includes("enotfound") ||
    m.includes("twelvedata unreachable") ||
    m.includes("upstream") ||
    m.includes("timeout") ||
    m.includes("binance error") ||
    m.includes("rate limit")
  )
}

function rrFromRiskProfile(riskProfile: string, marketType: "crypto" | "forex" | "metal") {
  const rp = (riskProfile || "").toLowerCase()

  if (marketType === "crypto") {
    if (rp.includes("conserv")) return { slAtr: 1.2, tp1rr: 1.3, tp2rr: 1.9 }
    if (rp.includes("aggress")) return { slAtr: 1.8, tp1rr: 1.2, tp2rr: 1.7 }
    return { slAtr: 1.5, tp1rr: 1.3, tp2rr: 1.8 }
  }

  if (rp.includes("conserv")) return { slAtr: 1.0, tp1rr: 1.5, tp2rr: 2.2 }
  if (rp.includes("aggress")) return { slAtr: 2.0, tp1rr: 1.3, tp2rr: 2.0 }
  return { slAtr: 1.5, tp1rr: 1.5, tp2rr: 2.0 }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function sortAscUnique(levels: number[]) {
  return Array.from(new Set(levels.filter((n) => Number.isFinite(n)))).sort((a, b) => a - b)
}

function nearestBelow(levels: number[], price: number): number | null {
  let best: number | null = null
  for (const lv of levels) {
    if (lv < price && (best === null || lv > best)) best = lv
  }
  return best
}

function nearestAbove(levels: number[], price: number): number | null {
  let best: number | null = null
  for (const lv of levels) {
    if (lv > price && (best === null || lv < best)) best = lv
  }
  return best
}

/**
 * ✅ Always pick nearest SR around lastClose (fix "index 0" bug)
 */
function pickNearestSupportResistance(technical: TechnicalSummary) {
  const price = technical.lastClose
  const supportsAsc = sortAscUnique(technical.supportLevels || [])
  const resistAsc = sortAscUnique(technical.resistanceLevels || [])

  const support = nearestBelow(supportsAsc, price) ?? supportsAsc[supportsAsc.length - 1] ?? price
  const resistance = nearestAbove(resistAsc, price) ?? resistAsc[0] ?? price

  const support2 = supportsAsc.filter((x) => x < support).pop()
  const resistance2 = resistAsc.find((x) => x > resistance)

  return { support, resistance, support2, resistance2, supportsAsc, resistAsc }
}

function priceBuffer(symbol: string, atr: number, lastClose: number) {
  const type = detectMarketType(symbol)
  const minAbs = Math.max(lastClose * 0.00005, 1e-9)

  if (type === "crypto") return Math.max(atr * 0.10, minAbs)
  if (type === "metal") return Math.max(atr * 0.06, minAbs)
  return Math.max(atr * 0.04, minAbs)
}

function applyVolatilityGuard(
  marketType: "crypto" | "forex" | "metal",
  technical: TechnicalSummary,
  warnings: string[],
  currentConfidence: number,
) {
  const atrPct = technical.lastClose > 0 ? technical.atrValue / technical.lastClose : 0
  const t = marketType === "crypto" ? 0.03 : marketType === "metal" ? 0.02 : 0.012

  if (atrPct > t) {
    warnings.push(`⚠️ Volatilitas tinggi (ATR ≈ ${(atrPct * 100).toFixed(2)}%). Kurangi lot / pertimbangkan WAIT jika banyak wick.`)
    return Math.min(currentConfidence, marketType === "crypto" ? 0.62 : 0.68)
  }
  return currentConfidence
}

function normalizeAndValidateLevels(ai: z.infer<typeof signalSchema>, technical: TechnicalSummary, req: SignalRequest) {
  const warnings: string[] = []

  const marketType = detectMarketType(req.symbol)
  const decimals = decimalsForSymbol(req.symbol)
  const round = (n: number) => Number(n.toFixed(decimals))

  const bias = ai.bias
  let entryType = ai.entry?.type ?? "Market"
  let entry = Number(ai.entry?.price ?? technical.lastClose)
  let stopLoss = Number(ai.stopLoss ?? technical.lastClose)
  let takeProfit = Array.isArray(ai.takeProfit) ? ai.takeProfit.map(Number) : []
  let confidence = clamp(Number(ai.confidence ?? 0.6), 0, 1)

  confidence = applyVolatilityGuard(marketType, technical, warnings, confidence)

  const { slAtr, tp1rr, tp2rr } = rrFromRiskProfile(req.riskProfile, marketType)
  const atr = Math.max(technical.atrValue, 1e-9)

  const isBuy = bias === "BUY"
  const isSell = bias === "SELL"
  const isWait = bias === "WAIT"

  const buffer = priceBuffer(req.symbol, atr, technical.lastClose)

  if (isWait) {
    entryType = "Market"
    entry = technical.lastClose
    const slDist = slAtr * atr
    stopLoss = entry - slDist
    const tp1 = entry + tp1rr * slDist
    const tp2 = entry + tp2rr * slDist
    takeProfit = [tp1, tp2]
  }

  if (isBuy || isSell) {
    const maxDev = marketType === "crypto" ? 3 * atr : 2 * atr
    if (Math.abs(entry - technical.lastClose) > maxDev) {
      warnings.push("Entry price disesuaikan agar lebih realistis dengan harga saat ini.")
      entry = technical.lastClose
    }

    // Ensure arrays are usable regardless of sort direction
    const supportsAsc = sortAscUnique(technical.supportLevels || [])
    const resistAsc = sortAscUnique(technical.resistanceLevels || [])

    if (isBuy) {
      const s1 = nearestBelow(supportsAsc, entry) ?? entry - slAtr * atr
      stopLoss = s1 - buffer

      if (stopLoss >= entry) {
        warnings.push("Stop Loss tidak valid untuk BUY; menggunakan ATR fallback.")
        stopLoss = entry - slAtr * atr
      }

      const r1 = nearestAbove(resistAsc, entry)
      const r2 = r1 ? nearestAbove(resistAsc.filter((x) => x !== r1), entry) : null

      if (r1 != null && r2 != null) {
        takeProfit = [r1, r2]
      } else {
        const risk = Math.abs(entry - stopLoss)
        takeProfit = [entry + tp1rr * risk, entry + tp2rr * risk]
      }

      let [tp1, tp2] = takeProfit
      if (!(stopLoss < entry && entry < tp1 && tp1 < tp2)) {
        warnings.push("Level trading disesuaikan untuk memastikan urutan BUY valid (SL < Entry < TP1 < TP2).")
        const risk = Math.abs(entry - stopLoss)
        tp1 = entry + tp1rr * risk
        tp2 = entry + tp2rr * risk
        takeProfit = [tp1, tp2]
      }
    }

    if (isSell) {
      const r1 = nearestAbove(resistAsc, entry) ?? entry + slAtr * atr
      stopLoss = r1 + buffer

      if (stopLoss <= entry) {
        warnings.push("Stop Loss tidak valid untuk SELL; menggunakan ATR fallback.")
        stopLoss = entry + slAtr * atr
      }

      const s1 = nearestBelow(supportsAsc, entry)
      const s2 = s1 ? nearestBelow(supportsAsc.filter((x) => x !== s1), entry) : null

      if (s1 != null && s2 != null) {
        takeProfit = [s1, s2]
      } else {
        const risk = Math.abs(entry - stopLoss)
        takeProfit = [entry - tp1rr * risk, entry - tp2rr * risk]
      }

      let [tp1, tp2] = takeProfit
      if (!(stopLoss > entry && entry > tp1 && tp1 > tp2)) {
        warnings.push("Level trading disesuaikan untuk memastikan urutan SELL valid (SL > Entry > TP1 > TP2).")
        const risk = Math.abs(entry - stopLoss)
        tp1 = entry - tp1rr * risk
        tp2 = entry - tp2rr * risk
        takeProfit = [tp1, tp2]
      }
    }

    // confidence adjustment by confirmations (keep your logic)
    let confirmationScore = 0
    const volTrend = technical.volumeProfile?.volumeTrend ?? "stable"

    if (isBuy) {
      if (technical.trend === "up") confirmationScore += 2
      else if (technical.trend === "sideways") confirmationScore += 1
      else {
        warnings.push("⚠️ KONFLIK: Trend DOWN tapi signal BUY. Pertimbangkan WAIT.")
        confidence = Math.min(confidence, 0.5)
      }

      if (technical.lastClose >= technical.ema12) confirmationScore++
      if (technical.macdHistogram > 0 || technical.macdValue > technical.macdSignal) confirmationScore++
      if (marketType === "crypto") {
        if (technical.rsiValue > 25 && technical.rsiValue < 80) confirmationScore++
      } else {
        if (technical.rsiValue > 30 && technical.rsiValue < 70) confirmationScore++
      }
      if ((technical.supportLevels || []).some((s) => Math.abs(entry - s) < atr)) confirmationScore++
      if (technical.candlestickPatterns.bullishEngulfing || technical.candlestickPatterns.hammer) confirmationScore++
      if (volTrend === "increasing") confirmationScore++
    }

    if (isSell) {
      if (technical.trend === "down") confirmationScore += 2
      else if (technical.trend === "sideways") confirmationScore += 1
      else {
        warnings.push("⚠️ KONFLIK: Trend UP tapi signal SELL. Pertimbangkan WAIT.")
        confidence = Math.min(confidence, 0.5)
      }

      if (technical.lastClose <= technical.ema12) confirmationScore++
      if (technical.macdHistogram < 0 || technical.macdValue < technical.macdSignal) confirmationScore++
      if (marketType === "crypto") {
        if (technical.rsiValue > 20 && technical.rsiValue < 75) confirmationScore++
      } else {
        if (technical.rsiValue > 30 && technical.rsiValue < 70) confirmationScore++
      }
      if ((technical.resistanceLevels || []).some((r) => Math.abs(entry - r) < atr)) confirmationScore++
      if (technical.candlestickPatterns.bearishEngulfing || technical.candlestickPatterns.shootingStar) confirmationScore++
      if (volTrend === "increasing") confirmationScore++
    }

    const strong = marketType === "crypto" ? 5 : 6
    const moderate = marketType === "crypto" ? 4 : 5

    if (confirmationScore >= strong) confidence = Math.max(confidence, 0.82)
    else if (confirmationScore >= moderate) confidence = clamp(confidence, 0.68, 0.82)
    else {
      warnings.push("Konfirmasi teknikal kurang kuat. Pertimbangkan WAIT.")
      confidence = Math.min(confidence, 0.55)
    }
  }

  let riskNotes = Array.isArray(ai.riskNotes) ? ai.riskNotes.filter(Boolean) : []
  if (riskNotes.length < 3) {
    const baseNotes = [
      `Gunakan risiko maksimal 1-2% dari account untuk ${req.symbol}.`,
      "Hindari entry saat rilis news besar / pergerakan ekstrem.",
      "Jangan geser Stop Loss menjauh dari harga entry - disiplin adalah kunci.",
    ]

    const marketNote =
      marketType === "crypto"
        ? "Crypto market 24/7: waspadai wick panjang dan fake breakout, terutama saat volume rendah."
        : `Perhatikan sesi trading: ${req.symbol.toUpperCase().includes("JPY") ? "Tokyo/London overlap optimal" : "London/NY overlap optimal"}.`

    riskNotes = [...riskNotes, ...baseNotes, marketNote].slice(0, 5)
  }

  let rationale = Array.isArray(ai.rationale) ? ai.rationale.filter(Boolean) : []
  if (rationale.length < 3) {
    const defaults = [
      `Trend ${technical.trend} dengan strength ${technical.trendStrength}.`,
      `MACD histogram ${technical.macdHistogram > 0 ? "positif" : "negatif"} (${technical.macdHistogram.toFixed(5)}).`,
      `RSI ${technical.rsiValue.toFixed(1)} menunjukkan ${
        technical.rsiValue > 85 ? "overbought" : technical.rsiValue < 15 ? "oversold" : "kondisi normal"
      }.`,
      `Harga ${technical.lastClose > technical.bollingerMiddle ? "di atas" : "di bawah"} Bollinger Middle Band.`,
    ]
    rationale = [...rationale, ...defaults].slice(0, 6)
  }

  entry = round(entry)
  stopLoss = round(stopLoss)
  takeProfit = takeProfit.map(round).slice(0, 2)

  if (bias === "WAIT") confidence = clamp(confidence, 0.4, 0.55)

  return {
    bias,
    entry: { type: entryType, price: entry },
    stopLoss,
    takeProfit,
    confidence,
    rationale: rationale.slice(0, 6),
    riskNotes: riskNotes.slice(0, 5),
    warnings,
  }
}

async function generateAISignal(data: SignalRequest, technical: TechnicalSummary) {
  const decimals = decimalsForSymbol(data.symbol)
  const marketType = detectMarketType(data.symbol)

  const prompt = `
Anda adalah expert trading analyst dengan pengalaman 10+ tahun.

Tugas: Analisis data teknikal berikut dan buat rekomendasi trading signal yang AKURAT.

=== MARKET TYPE ===
Market: ${marketType.toUpperCase()} (Forex / Crypto / Metal)
Catatan:
- Crypto market 24/7, volatilitas tinggi, sering fake breakout.
- Forex dipengaruhi sesi (Tokyo/London/NY).

=== DATA PASAR ===
Symbol: ${data.symbol}
Timeframe: ${data.timeframe}
Harga Terakhir: ${technical.lastClose.toFixed(decimals)}

=== INDIKATOR TEKNIKAL ===
Trend: ${technical.trend} (Strength: ${technical.trendStrength})
SMA20: ${technical.sma20.toFixed(decimals)}
SMA50: ${technical.sma50.toFixed(decimals)}
EMA12: ${technical.ema12.toFixed(decimals)}
EMA26: ${technical.ema26.toFixed(decimals)}

RSI14: ${technical.rsiValue.toFixed(1)} ${
    technical.rsiValue > 70 ? "(Overbought)" : technical.rsiValue < 30 ? "(Oversold)" : "(Neutral)"
  }
ATR14: ${technical.atrValue.toFixed(decimals)}

MACD: ${technical.macdValue.toFixed(5)}
MACD Signal: ${technical.macdSignal.toFixed(5)}
MACD Histogram: ${technical.macdHistogram.toFixed(5)} ${technical.macdHistogram > 0 ? "(Bullish)" : "(Bearish)"}

Bollinger Bands:
- Upper: ${technical.bollingerUpper.toFixed(decimals)}
- Middle: ${technical.bollingerMiddle.toFixed(decimals)}
- Lower: ${technical.bollingerLower.toFixed(decimals)}
- Position: ${
    technical.lastClose > technical.bollingerUpper
      ? "Above Upper"
      : technical.lastClose < technical.bollingerLower
        ? "Below Lower"
        : "Within Bands"
  }

Support Levels: ${technical.supportLevels.map((s) => s.toFixed(decimals)).join(", ")}
Resistance Levels: ${technical.resistanceLevels.map((r) => r.toFixed(decimals)).join(", ")}

Volume trend: ${technical.volumeProfile?.volumeTrend ?? "stable"}

Candlestick Patterns:
${technical.candlestickPatterns.bullishEngulfing ? "- Bullish Engulfing detected" : ""}
${technical.candlestickPatterns.bearishEngulfing ? "- Bearish Engulfing detected" : ""}
${technical.candlestickPatterns.hammer ? "- Hammer detected (bullish reversal)" : ""}
${technical.candlestickPatterns.shootingStar ? "- Shooting Star detected (bearish reversal)" : ""}
${technical.candlestickPatterns.doji ? "- Doji detected (indecision)" : ""}

=== PROFIL TRADING ===
Style: ${data.style}
Risk Profile: ${data.riskProfile}

=== RULES OUTPUT ===
- Bias: BUY/SELL/WAIT
- Entry.type: Market/Limit/Stop
- StopLoss & TakeProfit harus masuk akal dan konsisten dengan arah trade.
- TP maksimal 2 level.
- Confidence harus 0-1 (contoh 0.72).
- Rationale minimal 4 poin, Risk Notes minimal 3 poin.

PENTING:
- Jangan memaksakan BUY/SELL jika volatilitas ekstrim / sinyal konflik kuat.
- Untuk crypto, pertimbangkan fake breakout dan wick panjang (lebih ketat).
Output Bahasa Indonesia yang profesional dan actionable.
`.trim()

  const { object } = await generateObject({
    model: openai("gpt-4o-mini"),
    schema: signalSchema,
    prompt,
    temperature: 0.4,
  })

  return object
}

export async function POST(request: NextRequest) {
  try {
    const disableRateLimit = process.env.DISABLE_RATE_LIMIT === "true"
    let rateLimitMeta: { remaining: number } | null = null

    if (!disableRateLimit) {
      const clientIP = getClientIP(request)
      const rateLimit = signalRateLimiter.check(clientIP)

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: `Batas request tercapai. Maksimum 10 request per jam. Coba lagi dalam ${Math.ceil(
              rateLimit.resetInSeconds / 60,
            )} menit.`,
            type: "RATE_LIMIT",
            resetInSeconds: rateLimit.resetInSeconds,
          },
          { status: 429 },
        )
      }

      rateLimitMeta = { remaining: rateLimit.remaining }
    }

    const body: SignalRequest = await request.json()

    if (!body.symbol || !body.timeframe || !body.style || !body.riskProfile) {
      return NextResponse.json({ error: "Field wajib belum lengkap." }, { status: 400 })
    }

    envCheckOrThrowForRequest(body.symbol)

    const cacheKey = buildCacheKey(body)

    if (body.forceNew) {
      try {
        ;(signalCache as any).delete?.(cacheKey)
      } catch {}
    } else {
      const cached = signalCache.get<any>(cacheKey)
      if (cached) {
        const ttl = signalCache.getTTL(cacheKey)
        return NextResponse.json(
          { ...cached, cached: true, cacheExpiresIn: ttl },
          {
            status: 200,
            headers: {
              "X-Cache": "HIT",
              "X-Cache-TTL": String(ttl),
              ...(rateLimitMeta ? { "X-RateLimit-Remaining": String(rateLimitMeta.remaining) } : {}),
            },
          },
        )
      }
    }

    const signal = await generateSignal(body)
    signalCache.set(cacheKey, signal, SIGNAL_CACHE_TTL)

    return NextResponse.json(
      { ...signal, cached: false },
      {
        status: 200,
        headers: {
          "X-Cache": body.forceNew ? "BYPASS" : "MISS",
          ...(rateLimitMeta ? { "X-RateLimit-Remaining": String(rateLimitMeta.remaining) } : {}),
        },
      },
    )
  } catch (error) {
    console.error("[signal] route error:", error)
    const message = error instanceof Error ? error.message : "Terjadi kesalahan server."

    if (
      message.includes("No market data") ||
      message.includes("TWELVE_DATA_API_KEY") ||
      message.includes("OPENAI_API_KEY") ||
      isMarketNetworkErrorMessage(message)
    ) {
      const type =
        message.includes("OPENAI_API_KEY")
          ? "AI_AUTH_ERROR"
          : message.includes("TWELVE_DATA_API_KEY")
            ? "MARKET_DATA_ERROR"
            : "MARKET_DATA_ERROR"
      const status = message.includes("OPENAI_API_KEY") ? 401 : 503

      return NextResponse.json(
        {
          error: message,
          type,
          hint: "Cek koneksi / provider (Binance/TwelveData), atau coba beberapa saat lagi.",
        },
        { status },
      )
    }

    if (message.toLowerCase().includes("rate limit")) {
      return NextResponse.json({ error: message, type: "API_ERROR" }, { status: 429 })
    }

    return NextResponse.json({ error: message, type: "SERVER_ERROR" }, { status: 500 })
  }
}

async function generateSignal(data: SignalRequest) {
  console.log("[signal] fetching market data for", data.symbol, data.timeframe, {
    useMockData: process.env.USE_MOCK_MARKET_DATA === "true",
  })

  const marketData = await fetchOHLCData(data.symbol, data.timeframe, 200)

  console.log("[signal] market data received:", {
    symbol: data.symbol,
    latestPrice: marketData.latestPrice,
    candleCount: marketData.candles.length,
    firstCandle: marketData.candles[0]?.close,
    lastCandle: marketData.candles[marketData.candles.length - 1]?.close,
  })

  const technical: TechnicalSummary = calculateTechnicalSummary(marketData.candles, marketData.closePrices)

  console.log("[signal] enhanced technical analysis:", {
    trend: technical.trend,
    trendStrength: technical.trendStrength,
    rsi: technical.rsiValue,
    macd: technical.macdHistogram,
    atr: technical.atrValue,
    supports: technical.supportLevels,
    resistances: technical.resistanceLevels,
    patterns: technical.candlestickPatterns,
    lastClose: technical.lastClose,
  })

  // ✅ Generate AI recommendation
  const aiRaw = await generateAISignal(data, technical)
  const normalized = normalizeAndValidateLevels(aiRaw, technical, data)

  // ✅ Add deterministic probabilities (NOT from AI)
  const marketType = detectMarketType(data.symbol)
  const probs = calculateSignalProbabilities(technical, marketType)
  const probabilities = {
    buy: Number((probs.buy * 100).toFixed(0)),
    sell: Number((probs.sell * 100).toFixed(0)),
    wait: Number((probs.wait * 100).toFixed(0)),
    explanation: probs.explanation,
  }

  const decimals = decimalsForSymbol(data.symbol)
  const round = (num: number) => Number(num.toFixed(decimals))
  const format = (n: number) => Number(n.toFixed(decimals))

  // ✅ Build strategy plan based on nearest SR + ATR buffer
  const strategyPlan = buildStrategyPlan(
    {
      ...technical,
      // ensure we pass nearest SR fields too (technical already has them, but keep safe)
      support: technical.support,
      resistance: technical.resistance,
    },
    marketType,
    (n) => String(format(n)),
  )

  // Risk reward
  const risk = Math.abs(normalized.entry.price - normalized.stopLoss)
  const reward1 = Math.abs(normalized.takeProfit[0] - normalized.entry.price)
  const reward2 = Math.abs(normalized.takeProfit[1] - normalized.entry.price)
  const rr1 = risk > 0 ? reward1 / risk : 0
  const rr2 = risk > 0 ? reward2 / risk : 0

  // ✅ Fix support/resistance used in response: pick nearest around lastClose
  const picked = pickNearestSupportResistance(technical)

  return {
    id: `sig_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    symbol: data.symbol,
    timeframe: data.timeframe,
    style: data.style,
    risk: data.riskProfile,

    signal: normalized.bias,
    confidence: normalized.confidence,

    entryPrice: round(normalized.entry.price),
    entryType: normalized.entry.type,
    tp1: round(normalized.takeProfit[0]),
    tp2: round(normalized.takeProfit[1]),
    stopLoss: round(normalized.stopLoss),

    riskReward: {
      tp1: Number(rr1.toFixed(2)),
      tp2: Number(rr2.toFixed(2)),
    },

    // ✅ NEW fields for UI
    probabilities,
    strategyPlan,

    rationale: normalized.rationale,
    riskNotes: [
      ...normalized.riskNotes,
      "⚠️ DISCLAIMER: Signal ini adalah hasil analisa teknikal dan AI. Bukan nasihat finansial. Trading berisiko tinggi - gunakan money management yang ketat.",
    ],
    warnings: normalized.warnings,

    timestamp: new Date().toISOString(),

    technical: {
      trend: technical.trend,
      rsi: technical.rsiValue,
      atr: technical.atrValue,
      support: picked.support,
      resistance: picked.resistance,
    },
  }
}

function buildCacheKey(body: SignalRequest) {
  const sym = normalizeSymbol(body.symbol)
  return [
    "signal",
    sym,
    (body.timeframe || "").trim(),
    (body.style || "").trim(),
    (body.riskProfile || "").trim(),
    body.accountSize ?? "na",
    body.maxRiskPercent ?? "na",
  ]
    .join(":")
    .toLowerCase()
}