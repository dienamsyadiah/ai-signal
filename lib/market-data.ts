// lib/market-data.ts

export type Candle = {
  time: string
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type LivePriceArgs = {
  symbol: string
  timeframe?: string
}

export type LivePriceResult = {
  symbol: string
  price: number
  timestamp: string
  source?: string
}

export type OHLCResult = {
  symbol: string
  timeframe: string
  candles: Candle[]
  closePrices: number[]
  latestPrice: number
  timestamp: string
  source?: string
}

/**
 * last-good cache to reduce 500s when provider intermittent / rate limit
 */
const lastGoodPrice = new Map<string, LivePriceResult>()
const lastGoodOHLC = new Map<string, OHLCResult>()

function cacheKey(symbol: string, timeframe: string) {
  return `${symbol}__${timeframe}`
}

/**
 * ✅ TwelveData key
 */
function getProviderKeyOrThrow() {
  const key = process.env.TWELVE_DATA_API_KEY || process.env.TWELVEDATA_API_KEY
  if (!key) {
    throw new Error("TWELVE_DATA_API_KEY belum diset. Tambahkan di .env.local lalu restart server.")
  }
  return key
}

/**
 * Detect market type from symbol
 */
function detectMarket(symbol: string): "crypto" | "forex" | "metal" {
  const s = (symbol || "").toUpperCase().replace("/", "").trim()
  if (!s) return "forex"
  if (s.includes("XAU") || s.includes("XAG")) return "metal"
  if (
    s.includes("USDT") ||
    s.startsWith("BTC") ||
    s.startsWith("ETH") ||
    s.startsWith("SOL") ||
    s.startsWith("BNB") ||
    s.startsWith("XRP")
  )
    return "crypto"
  return "forex"
}

/**
 * Normalize symbol for TwelveData:
 * - "USDJPY" => "USD/JPY"
 * - "EURUSD" => "EUR/USD"
 * - "BTCUSD" => "BTC/USD"
 * - "BTCUSDT" => "BTC/USDT"
 */
export function normalizeSymbol(symbol: string): string {
  const s = (symbol || "").trim().toUpperCase()
  if (!s) return "BTC/USD"
  if (s.includes("/")) return s

  if (/^[A-Z]{6}$/.test(s)) return `${s.slice(0, 3)}/${s.slice(3, 6)}`

  if (/^[A-Z]{3,10}USD$/.test(s)) {
    const base = s.replace(/USD$/, "")
    return `${base}/USD`
  }

  if (/^[A-Z]{3,10}USDT$/.test(s)) {
    const base = s.replace(/USDT$/, "")
    return `${base}/USDT`
  }

  return s
}

/**
 * ✅ Binance expects BTCUSDT (no slash)
 */
function normalizeSymbolBinance(symbol: string): string {
  return (symbol || "").toUpperCase().replace("/", "").trim()
}

/**
 * Normalize timeframe from app input to TwelveData interval
 */
export function normalizeTimeframe(tf: string): string {
  const t = (tf || "").trim().toUpperCase()
  if (t.endsWith("MIN") || t.endsWith("H") || t.endsWith("DAY") || t.endsWith("WEEK")) return t.toLowerCase()

  if (t === "M1") return "1min"
  if (t === "M5") return "5min"
  if (t === "M15") return "15min"
  if (t === "M30") return "30min"
  if (t === "H1") return "1h"
  if (t === "H2") return "2h"
  if (t === "H4") return "4h"
  if (t === "D1") return "1day"
  if (t === "W1") return "1week"

  const lower = (tf || "").trim().toLowerCase()
  if (lower === "1m") return "1min"
  if (lower === "5m") return "5min"
  if (lower === "15m") return "15min"
  if (lower === "30m") return "30min"
  if (lower === "1h") return "1h"
  if (lower === "2h") return "2h"
  if (lower === "4h") return "4h"
  if (lower === "1d") return "1day"
  if (lower === "1w") return "1week"

  return "15min"
}

/**
 * ✅ Binance timeframe mapping
 */
function normalizeTimeframeBinance(tf: string): string {
  const t = (tf || "").trim().toUpperCase()
  if (t === "M1") return "1m"
  if (t === "M5") return "5m"
  if (t === "M15") return "15m"
  if (t === "M30") return "30m"
  if (t === "H1") return "1h"
  if (t === "H2") return "2h"
  if (t === "H4") return "4h"
  if (t === "D1") return "1d"

  const lower = (tf || "").trim().toLowerCase()
  if (["1m", "5m", "15m", "30m", "1h", "2h", "4h", "1d"].includes(lower)) return lower

  return "15m"
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 15000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
    const text = await res.text()
    let json: any = null
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      json = null
    }
    return { res, json, text }
  } finally {
    clearTimeout(id)
  }
}

/**
 * ============================
 * BINANCE (CRYPTO USDT)
 * ============================
 */

async function getLivePriceBinance(symbol: string): Promise<LivePriceResult> {
  const sym = normalizeSymbolBinance(symbol)

  const url = new URL("https://api.binance.com/api/v3/ticker/price")
  url.searchParams.set("symbol", sym)

  const { res, json, text } = await fetchJsonWithTimeout(url.toString(), 12000)
  if (!res.ok) {
    throw new Error(`Binance error ${res.status}: ${text || "failed"}`)
  }

  const price = Number(json?.price)
  if (!Number.isFinite(price)) throw new Error("Invalid price from Binance")

  return {
    symbol: sym,
    price,
    timestamp: new Date().toISOString(),
    source: "binance",
  }
}

async function fetchOHLCBinance(symbol: string, timeframe: string, limit = 200): Promise<OHLCResult> {
  const sym = normalizeSymbolBinance(symbol)
  const interval = normalizeTimeframeBinance(timeframe)
  const lim = Math.min(Math.max(limit, 50), 1000)

  const url = new URL("https://api.binance.com/api/v3/klines")
  url.searchParams.set("symbol", sym)
  url.searchParams.set("interval", interval)
  url.searchParams.set("limit", String(lim))

  const { res, json, text } = await fetchJsonWithTimeout(url.toString(), 15000)
  if (!res.ok) {
    throw new Error(`Binance error ${res.status}: ${text || "failed"}`)
  }

  if (!Array.isArray(json) || json.length < 10) {
    throw new Error("No market data (insufficient candles)")
  }

  const candles: Candle[] = json
    .map((k: any) => {
      const openTime = k?.[0]
      const open = Number(k?.[1])
      const high = Number(k?.[2])
      const low = Number(k?.[3])
      const close = Number(k?.[4])
      const volume = Number(k?.[5])

      if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) return null

      return {
        time: typeof openTime === "number" ? new Date(openTime).toISOString() : String(openTime),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : undefined,
      }
    })
    .filter(Boolean) as Candle[]

  const closePrices = candles.map((c) => c.close)
  const latestPrice = closePrices[closePrices.length - 1] ?? 0

  const out: OHLCResult = {
    symbol: sym,
    timeframe: interval,
    candles,
    closePrices,
    latestPrice,
    timestamp: new Date().toISOString(),
    source: "binance",
  }

  return out
}

/**
 * ============================
 * TWELVEDATA (FOREX / METAL)
 * ============================
 */

/**
 * Helper: decide if we should fallback USDT -> USD (kept, but crypto now uses Binance, so rarely needed)
 */
function shouldFallbackToUSD(sym: string, errMsg: string) {
  const s = sym.toUpperCase()
  if (!s.includes("USDT")) return false
  const m = (errMsg || "").toLowerCase()
  return m.includes("invalid") || m.includes("symbol") || m.includes("not supported") || m.includes("unknown")
}

function fallbackUSDTtoUSD(sym: string): string {
  return sym.replace("/USDT", "/USD")
}

/**
 * ✅ Used by /api/price
 * Crypto => Binance
 * Forex/Metal => TwelveData
 */
export async function getLivePrice({ symbol, timeframe = "5m" }: LivePriceArgs): Promise<LivePriceResult> {
  const market = detectMarket(symbol)

  // ✅ CRYPTO: Binance
  if (market === "crypto") {
    const sym = normalizeSymbolBinance(symbol)
    const key0 = cacheKey(sym, timeframe)
    try {
      const out = await getLivePriceBinance(symbol)
      lastGoodPrice.set(key0, out)
      return out
    } catch (err) {
      const fallback = lastGoodPrice.get(key0)
      if (fallback) return { ...fallback, source: "cache(exception)" }
      throw err
    }
  }

  // ✅ FOREX/METAL: TwelveData
  const apiKey = getProviderKeyOrThrow()
  const sym0 = normalizeSymbol(symbol)
  const tf = (timeframe || "5m").trim()
  const key0 = cacheKey(sym0, tf)

  const callProvider = async (sym: string): Promise<LivePriceResult> => {
    const url = new URL("https://api.twelvedata.com/price")
    url.searchParams.set("symbol", sym)
    url.searchParams.set("apikey", apiKey)

    const { res, json } = await fetchJsonWithTimeout(url.toString(), 12000)

    if (!res.ok) {
      if (res.status === 429) {
        const fallback = lastGoodPrice.get(cacheKey(sym, tf))
        if (fallback) return { ...fallback, source: "cache(rate-limit)" }
        throw new Error("Rate limit from provider (429)")
      }
      const detail = (json && (json.message || json.error)) || `HTTP ${res.status}`
      throw new Error(`Upstream error: ${detail}`)
    }

    if (json?.status === "error") {
      const detail = json?.message || "Provider returned error"
      throw new Error(detail)
    }

    const price = Number(json?.price)
    if (!Number.isFinite(price)) throw new Error("Invalid price from provider")

    const out: LivePriceResult = {
      symbol: sym,
      price,
      timestamp: new Date().toISOString(),
      source: "twelvedata",
    }
    lastGoodPrice.set(cacheKey(sym, tf), out)
    return out
  }

  try {
    const out = await callProvider(sym0)
    lastGoodPrice.set(key0, out)
    return out
  } catch (err: any) {
    const msg = String(err?.message || err)

    // optional fallback USDT -> USD (kept)
    if (shouldFallbackToUSD(sym0, msg)) {
      const sym1 = fallbackUSDTtoUSD(sym0)
      try {
        const out2 = await callProvider(sym1)
        lastGoodPrice.set(key0, { ...out2, symbol: sym0, source: "twelvedata(fallback-usd)" })
        return { ...out2, symbol: sym0, source: "twelvedata(fallback-usd)" }
      } catch {
        // continue
      }
    }

    const fallback = lastGoodPrice.get(key0)
    if (fallback) return { ...fallback, source: "cache(exception)" }
    throw err
  }
}

/**
 * ✅ Used by /api/signal
 * Crypto => Binance
 * Forex/Metal => TwelveData
 */
export async function fetchOHLCData(
  symbol: string,
  timeframe: string,
  limit = 200,
): Promise<{
  symbol: string
  timeframe: string
  candles: Candle[]
  closePrices: number[]
  latestPrice: number
}> {
  const market = detectMarket(symbol)

  // ✅ CRYPTO: Binance OHLC
  if (market === "crypto") {
    const sym = normalizeSymbolBinance(symbol)
    const interval = normalizeTimeframeBinance(timeframe)
    const key0 = cacheKey(sym, interval)

    try {
      const out = await fetchOHLCBinance(symbol, timeframe, limit)
      lastGoodOHLC.set(key0, out)
      return { symbol: out.symbol, timeframe: out.timeframe, candles: out.candles, closePrices: out.closePrices, latestPrice: out.latestPrice }
    } catch (err) {
      const fallback = lastGoodOHLC.get(key0)
      if (fallback) {
        return { symbol: fallback.symbol, timeframe: fallback.timeframe, candles: fallback.candles, closePrices: fallback.closePrices, latestPrice: fallback.latestPrice }
      }
      throw err
    }
  }

  // ✅ FOREX/METAL: TwelveData OHLC
  const apiKey = getProviderKeyOrThrow()
  const sym0 = normalizeSymbol(symbol)
  const interval = normalizeTimeframe(timeframe)
  const outputsize = Math.min(Math.max(limit, 50), 1000)
  const key0 = cacheKey(sym0, interval)

  const callProvider = async (sym: string) => {
    const url = new URL("https://api.twelvedata.com/time_series")
    url.searchParams.set("symbol", sym)
    url.searchParams.set("interval", interval)
    url.searchParams.set("outputsize", String(outputsize))
    url.searchParams.set("apikey", apiKey)

    const { res, json } = await fetchJsonWithTimeout(url.toString(), 15000)

    if (!res.ok) {
      if (res.status === 429) {
        const fallback = lastGoodOHLC.get(cacheKey(sym, interval))
        if (fallback) return fallback
        throw new Error("Rate limit from provider (429)")
      }
      const detail = (json && (json.message || json.error)) || `HTTP ${res.status}`
      throw new Error(`Upstream error: ${detail}`)
    }

    if (json?.status === "error") {
      throw new Error(json?.message || "Provider returned error")
    }

    const values = Array.isArray(json?.values) ? json.values : null
    if (!values || values.length < 10) throw new Error("No market data (insufficient candles)")

    const candles: Candle[] = values
      .map((v: any) => {
        const time = String(v?.datetime ?? "")
        const open = Number(v?.open)
        const high = Number(v?.high)
        const low = Number(v?.low)
        const close = Number(v?.close)

        const volRaw = v?.volume
        const volume = volRaw != null ? Number(volRaw) : undefined
        const volumeSafe = Number.isFinite(volume) ? volume : undefined

        if (!time || !Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) {
          return null
        }
        return { time, open, high, low, close, volume: volumeSafe }
      })
      .filter(Boolean) as Candle[]

    candles.sort((a, b) => a.time.localeCompare(b.time))

    const closePrices = candles.map((c) => c.close)
    const latestPrice = closePrices[closePrices.length - 1] ?? 0

    const out: OHLCResult = {
      symbol: sym,
      timeframe: interval,
      candles,
      closePrices,
      latestPrice,
      timestamp: new Date().toISOString(),
      source: "twelvedata",
    }

    lastGoodOHLC.set(cacheKey(sym, interval), out)
    return out
  }

  try {
    const out = await callProvider(sym0)
    lastGoodOHLC.set(key0, out)
    return { symbol: sym0, timeframe: interval, candles: out.candles, closePrices: out.closePrices, latestPrice: out.latestPrice }
  } catch (err: any) {
    const msg = String(err?.message || err)

    if (shouldFallbackToUSD(sym0, msg)) {
      const sym1 = fallbackUSDTtoUSD(sym0)
      try {
        const out2 = await callProvider(sym1)
        lastGoodOHLC.set(key0, { ...out2, symbol: sym0, source: "twelvedata(fallback-usd)" })
        return { symbol: sym0, timeframe: interval, candles: out2.candles, closePrices: out2.closePrices, latestPrice: out2.latestPrice }
      } catch {
        // continue
      }
    }

    const fallback = lastGoodOHLC.get(key0)
    if (fallback) {
      return { symbol: sym0, timeframe: interval, candles: fallback.candles, closePrices: fallback.closePrices, latestPrice: fallback.latestPrice }
    }
    throw err
  }
}