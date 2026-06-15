"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatPrice } from "@/lib/price-format"

type Props = {
  symbol: string
  timeframe: string
  entryPrice: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  signal: "BUY" | "SELL" | "WAIT"
  onPriceUpdate?: (price: number) => void
  onAlertTriggered?: (type: "ENTRY" | "STOP_LOSS" | "TAKE_PROFIT_1" | "TAKE_PROFIT_2", level: number) => void
}

type PriceResponse = {
  symbol: string
  price: number
  timestamp?: string
  source?: string
}

export function LivePriceMonitor({
  symbol,
  timeframe,
  entryPrice,
  stopLoss,
  takeProfit1,
  takeProfit2,
  signal,
  onPriceUpdate,
  onAlertTriggered,
}: Props) {
  const [price, setPrice] = useState<number | null>(null)
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle")
  const [lastAt, setLastAt] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string>("")

  // one in-flight request at a time
  const abortRef = useRef<AbortController | null>(null)

  // schedule polling safely
  const timerRef = useRef<number | null>(null)
  const backoffMsRef = useRef<number>(0)

  // prevent repeated alerts
  const triggeredRef = useRef<Record<string, boolean>>({})

  const pollMs = 2000 // normal polling cadence (2s)

  const apiUrl = useMemo(() => {
    const sp = new URLSearchParams({ symbol, timeframe })
    return `/api/price?${sp.toString()}`
  }, [symbol, timeframe])

  // reset alert flags when signal context changes (symbol/timeframe/levels/signal)
  useEffect(() => {
    triggeredRef.current = {}
    setMarketBaseline()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbol, timeframe, entryPrice, stopLoss, takeProfit1, takeProfit2, signal])

  // optional: baseline for ENTRY alert, if you ever want it
  const baselineRef = useRef<number | null>(null)
  function setMarketBaseline() {
    baselineRef.current = null
  }

  const triggerOnce = useCallback(
    (key: string, type: "ENTRY" | "STOP_LOSS" | "TAKE_PROFIT_1" | "TAKE_PROFIT_2", level: number) => {
      if (triggeredRef.current[key]) return
      triggeredRef.current[key] = true
      onAlertTriggered?.(type, level)
    },
    [onAlertTriggered],
  )

  const checkAlerts = useCallback(
    (p: number) => {
      if (!Number.isFinite(p)) return
      if (signal === "WAIT") return

      // Baseline set (first valid price)
      if (baselineRef.current == null) baselineRef.current = p

      // NOTE: "ENTRY" alert is optional — uncomment if you want
      // const entryKey = `ENTRY_${entryPrice}`
      // const nearEntry = entryPrice > 0 && Math.abs((p - entryPrice) / entryPrice) * 100 < 0.05
      // if (nearEntry) triggerOnce(entryKey, "ENTRY", entryPrice)

      if (signal === "BUY") {
        if (p <= stopLoss) triggerOnce(`SL_${stopLoss}`, "STOP_LOSS", stopLoss)
        if (p >= takeProfit1) triggerOnce(`TP1_${takeProfit1}`, "TAKE_PROFIT_1", takeProfit1)
        if (p >= takeProfit2) triggerOnce(`TP2_${takeProfit2}`, "TAKE_PROFIT_2", takeProfit2)
      } else if (signal === "SELL") {
        if (p >= stopLoss) triggerOnce(`SL_${stopLoss}`, "STOP_LOSS", stopLoss)
        if (p <= takeProfit1) triggerOnce(`TP1_${takeProfit1}`, "TAKE_PROFIT_1", takeProfit1)
        if (p <= takeProfit2) triggerOnce(`TP2_${takeProfit2}`, "TAKE_PROFIT_2", takeProfit2)
      }
    },
    [signal, stopLoss, takeProfit1, takeProfit2, triggerOnce],
  )

  const fetchPrice = useCallback(async () => {
    // Abort previous in-flight request to avoid piling up
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const res = await fetch(apiUrl, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      })

      if (!res.ok) {
        const txt = await res.text().catch(() => "")
        throw new Error(`Failed to fetch price (${res.status}) ${txt}`.trim())
      }

      const data = (await res.json()) as PriceResponse
      const p = Number(data?.price)

      if (!Number.isFinite(p)) throw new Error("Invalid price in response")

      setPrice(p)
      setStatus("ok")
      setErrorMsg("")
      setLastAt(data?.timestamp ? new Date(data.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString())

      onPriceUpdate?.(p)
      checkAlerts(p)

      // reset backoff on success
      backoffMsRef.current = 0
      return true
    } catch (e: any) {
      if (e?.name === "AbortError") return false

      setStatus("error")
      setErrorMsg(e instanceof Error ? e.message : "Unknown error")

      // increase backoff: 2s -> 4s -> 8s -> max 15s
      const current = backoffMsRef.current || pollMs
      backoffMsRef.current = Math.min(current * 2, 15000)
      return false
    }
  }, [apiUrl, checkAlerts, onPriceUpdate, pollMs])

  const scheduleNext = useCallback(
    (delayMs: number) => {
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = window.setTimeout(async () => {
        await fetchPrice()
        const nextDelay = backoffMsRef.current > 0 ? backoffMsRef.current : pollMs
        scheduleNext(nextDelay)
      }, delayMs)
    },
    [fetchPrice, pollMs],
  )

  useEffect(() => {
    // restart polling whenever apiUrl changes (symbol/timeframe)
    setStatus("idle")
    setErrorMsg("")
    setLastAt("")
    setPrice(null)

    // first fetch immediately, then schedule next based on result
    ;(async () => {
      await fetchPrice()
      const nextDelay = backoffMsRef.current > 0 ? backoffMsRef.current : pollMs
      scheduleNext(nextDelay)
    })()

    return () => {
      abortRef.current?.abort()
      if (timerRef.current) window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [apiUrl, fetchPrice, pollMs, scheduleNext])

  const pnl = useMemo(() => {
    if (price == null || !Number.isFinite(price)) return null
    if (!Number.isFinite(entryPrice) || entryPrice <= 0) return null

    const diff = signal === "SELL" ? entryPrice - price : price - entryPrice
    const pct = (diff / entryPrice) * 100
    return { diff, pct }
  }, [entryPrice, price, signal])

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <span>Live Price</span>
          <Badge variant="outline">
            {symbol} • {timeframe}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="flex items-baseline justify-between">
          <div>
            <div className="text-sm text-muted-foreground">Harga Saat Ini</div>
            <div className="text-2xl font-bold font-mono">{price == null ? "-" : formatPrice(price, symbol)}</div>
            <div className="text-xs text-muted-foreground">Update: {lastAt || "-"}</div>
          </div>

          <div className="text-right">
            <div className="text-sm text-muted-foreground">Status</div>
            <div className="text-sm">
              {status === "ok" && <span className="text-green-600">OK</span>}
              {status === "idle" && <span className="text-muted-foreground">...</span>}
              {status === "error" && <span className="text-red-600">ERROR</span>}
            </div>
          </div>
        </div>

        {pnl && signal !== "WAIT" && (
          <div className="rounded-lg bg-muted p-3 flex items-center justify-between">
            <div className="text-sm text-muted-foreground">P/L dari Entry</div>
            <div className="text-sm font-mono font-semibold">
              {formatPrice(pnl.diff, symbol)} ({pnl.pct.toFixed(2)}%)
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-700">
            {errorMsg || "Gagal mengambil harga"}
            <div className="mt-2">
              <button
                className="underline"
                onClick={() => {
                  backoffMsRef.current = 0
                  void fetchPrice()
                }}
              >
                Coba lagi
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <div className="rounded-md border p-2">
            Entry: <span className="font-mono text-foreground">{formatPrice(entryPrice, symbol)}</span>
          </div>
          <div className="rounded-md border p-2">
            SL: <span className="font-mono text-foreground">{formatPrice(stopLoss, symbol)}</span>
          </div>
          <div className="rounded-md border p-2">
            TP1: <span className="font-mono text-foreground">{formatPrice(takeProfit1, symbol)}</span>
          </div>
          <div className="rounded-md border p-2">
            TP2: <span className="font-mono text-foreground">{formatPrice(takeProfit2, symbol)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}