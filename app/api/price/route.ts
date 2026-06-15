// app/api/price/route.ts
import { NextResponse } from "next/server"
import { getLivePrice } from "@/lib/market-data"

// cache in-memory sederhana (per server instance)
type CacheEntry = { data: any; expiresAt: number }
const cache = new Map<string, CacheEntry>()

function detectMarket(symbol: string): "crypto" | "forex" | "metal" {
  const s = (symbol || "").toUpperCase().replace("/", "").trim()
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
 * ✅ Stable cache key:
 * - Crypto: keep as BTCUSDT (no slash)
 * - Forex/Metal: keep as EURUSD, USDJPY, XAUUSD (no slash)
 */
function normalizeSymbolForCache(symbol: string) {
  return (symbol || "").toUpperCase().replace("/", "").trim() || "BTCUSDT"
}

function getCacheTtlMs(symbol: string) {
  const market = detectMarket(symbol)
  // Crypto realtime
  if (market === "crypto") return 3_000
  // Forex/metal lebih hemat kuota provider
  return 15_000
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const symbolRaw = (searchParams.get("symbol") || "BTCUSDT").trim()
    const timeframeRaw = (searchParams.get("timeframe") || "M5").trim()

    if (!symbolRaw) {
      return NextResponse.json({ error: "symbol is required" }, { status: 400 })
    }

    const symKey = normalizeSymbolForCache(symbolRaw)
    // timeframe dipakai untuk compatibility aja (UI kamu kirim timeframe),
    // tapi untuk price provider tidak wajib.
    const key = `${symKey}__price`

    const now = Date.now()
    const cached = cache.get(key)
    if (cached && cached.expiresAt > now) {
      return NextResponse.json(cached.data, {
        status: 200,
        headers: { "X-Cache": "HIT" },
      })
    }

    const data = await getLivePrice({ symbol: symbolRaw, timeframe: timeframeRaw })

    const ttl = getCacheTtlMs(symbolRaw)
    cache.set(key, { data, expiresAt: now + ttl })

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "X-Cache": "MISS",
        "X-Cache-TTL": String(ttl),
      },
    })
  } catch (err: any) {
    const message = err?.message || "Internal error while fetching price"
    return NextResponse.json({ error: message }, { status: 500 })
  }
}