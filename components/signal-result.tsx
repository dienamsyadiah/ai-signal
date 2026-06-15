"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Save,
  Copy,
  CheckCircle2,
  RefreshCw,
  Clock,
  Database,
  Zap,
  AlertTriangle,
  Check,
  Target,
  Shield,
  TrendingUp,
  TrendingDown,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { useToast } from "@/hooks/use-toast"
import { getConfidenceLevel, formatLevelsForCopy, formatPrice } from "@/lib/price-format"
import { SignalCountdown } from "./signal-countdown"
import { calculateValidityPeriod } from "@/lib/timeframe-utils"

// ✅ IMPORTANT: named import must match named export in live-price-monitor.tsx
import { LivePriceMonitor } from "./live-price-monitor"

import { PnLCalculator } from "./pnl-calculator"
import type { SignalHistoryItem } from "@/lib/history"
import { saveToHistory } from "@/lib/history"

interface SignalProbabilities {
  buy: number // 0..100
  sell: number // 0..100
  wait: number // 0..100
  explanation?: string[]
}

interface StrategyScenario {
  title: string
  trigger: string
  entry: string
  stopLoss: string
  takeProfit: string
  invalidation: string
}

interface StrategyPlan {
  keyLevels: {
    support: number
    resistance: number
    support2?: number
    resistance2?: number
  }
  bullish: StrategyScenario
  bearish: StrategyScenario
  notes?: string[]
}

interface Signal {
  id: string
  symbol: string
  timeframe: string
  style: string
  risk: string
  signal: "BUY" | "SELL" | "WAIT"
  confidence: number // 0..1
  entryPrice: number
  entryType: string
  tp1: number
  tp2: number
  stopLoss: number
  rationale: string[]
  riskNotes: string[]
  warnings?: string[]
  timestamp: string
  technical: {
    trend: string
    rsi: number
    atr: number
    support: number
    resistance: number
  }
  probabilities?: SignalProbabilities
  strategyPlan?: StrategyPlan
  cached?: boolean
  cacheExpiresIn?: number
}

interface RateLimitError {
  error: string
  type: "RATE_LIMIT"
  resetInSeconds: number
}

function SignalSkeleton() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-48" />
          <Skeleton className="h-5 w-64" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-40" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-2 lg:col-span-6">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-48" />
            </CardHeader>
            <CardContent className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-yellow-500/10">
        <AlertTriangle className="h-10 w-10 text-yellow-600" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Gagal Generate Signal</h2>
      <p className="mb-6 text-muted-foreground text-sm leading-relaxed">
        Tidak dapat menghasilkan signal. Periksa parameter Anda dan coba lagi.
      </p>
      <div className="flex gap-3 justify-center flex-wrap">
        <Button variant="outline" onClick={onRetry}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Coba Lagi
        </Button>
        <Button onClick={() => (window.location.href = "/")}>Kembali ke Home</Button>
      </div>
    </div>
  )
}

function RateLimitState({ resetInSeconds, onRetry }: { resetInSeconds: number; onRetry: () => void }) {
  const [countdown, setCountdown] = useState(resetInSeconds)

  useEffect(() => {
    if (countdown <= 0) return
    const timer = setInterval(() => setCountdown((prev) => Math.max(0, prev - 1)), 1000)
    return () => clearInterval(timer)
  }, [countdown])

  const minutes = Math.floor(countdown / 60)
  const seconds = countdown % 60

  return (
    <div className="mx-auto max-w-md py-12 text-center">
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-500/10">
        <Zap className="h-10 w-10 text-red-600" />
      </div>
      <h2 className="text-xl font-semibold mb-2">Rate Limit Tercapai</h2>
      <p className="mb-4 text-muted-foreground text-sm leading-relaxed">
        Anda telah mencapai batas request. Coba lagi setelah countdown selesai.
      </p>
      <div className="mb-6 p-4 rounded-lg bg-muted">
        <p className="text-sm text-muted-foreground mb-1">Dapat request lagi dalam:</p>
        <p className="text-2xl font-bold font-mono">
          {minutes}:{seconds.toString().padStart(2, "0")}
        </p>
      </div>
      <div className="flex gap-3 justify-center flex-wrap">
        <Button variant="outline" onClick={onRetry} disabled={countdown > 0}>
          <RefreshCw className="h-4 w-4 mr-2" />
          {countdown > 0 ? "Tunggu..." : "Coba Lagi"}
        </Button>
        <Button onClick={() => (window.location.href = "/history")}>Lihat History</Button>
      </div>
    </div>
  )
}

/**
 * ✅ RULES:
 * - Jika satu sisi “tidak ada kemungkinan” (di bawah ambang), jangan tampilkan
 * - Kalau yang tampil hanya 1 → jadi 100%
 * - Kalau yang tampil 2/3 → dinormalisasi jadi total = 100%
 */
function pickAndNormalizeProbabilities(p: SignalProbabilities, minDisplay = 12) {
  const rows = [
    { k: "BUY" as const, v: Number.isFinite(p.buy) ? p.buy : 0 },
    { k: "SELL" as const, v: Number.isFinite(p.sell) ? p.sell : 0 },
    { k: "WAIT" as const, v: Number.isFinite(p.wait) ? p.wait : 0 },
  ].sort((a, b) => b.v - a.v)

  let picked = rows.filter((r) => r.v >= minDisplay)
  if (picked.length === 0) picked = [rows[0]]

  if (picked.length === 1) return [{ ...picked[0], v: 100 }]

  const sum = picked.reduce((a, b) => a + b.v, 0) || 1
  let normalized = picked.map((r) => ({ ...r, v: Math.round((r.v / sum) * 100) }))

  const total = normalized.reduce((a, b) => a + b.v, 0)
  const diff = 100 - total
  if (diff !== 0) normalized[0] = { ...normalized[0], v: normalized[0].v + diff }

  return normalized
}

export function SignalResult() {
  const searchParams = useSearchParams()
  const { toast } = useToast()

  const [signal, setSignal] = useState<Signal | null>(null)
  const [loading, setLoading] = useState(true)
  const [regenerating, setRegenerating] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(false)
  const [rateLimitError, setRateLimitError] = useState<RateLimitError | null>(null)
  const [remainingRequests, setRemainingRequests] = useState<number | null>(null)
  const [autoRegenerate, setAutoRegenerate] = useState(true)
  const [currentPrice, setCurrentPrice] = useState<number | null>(null)
  const [marketConditionChanged, setMarketConditionChanged] = useState(false)

  const abortRef = useRef<AbortController | null>(null)
  const queryKey = useMemo(() => searchParams.toString(), [searchParams])

  const fetchSignal = async (opts?: { force?: boolean }) => {
    setRateLimitError(null)

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const symbol = searchParams.get("symbol")
      const timeframe = searchParams.get("timeframe")
      const style = searchParams.get("style")
      const riskProfile = searchParams.get("riskProfile")
      const accountSize = searchParams.get("accountSize")
      const maxRiskPercent = searchParams.get("maxRiskPercent")

      if (!symbol || !timeframe || !style || !riskProfile) {
        setLoading(false)
        return
      }

      const payload: {
        symbol: string
        timeframe: string
        style: string
        riskProfile: string
        accountSize?: number
        maxRiskPercent?: number
        forceNew?: boolean
      } = { symbol, timeframe, style, riskProfile }

      if (accountSize) payload.accountSize = Number(accountSize)
      if (maxRiskPercent) payload.maxRiskPercent = Number(maxRiskPercent)
      if (opts?.force) payload.forceNew = true

      const response = await fetch("/api/signal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })

      if (response.status === 429) {
        const errorData = await response.json()
        if (errorData.type === "RATE_LIMIT") {
          setRateLimitError(errorData)
          setLoading(false)
          setRegenerating(false)
          return
        }
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Failed to fetch signal" }))
        throw new Error(errorData.error || "Failed to fetch signal")
      }

      const remaining = response.headers.get("X-RateLimit-Remaining")
      if (remaining) setRemainingRequests(Number.parseInt(remaining, 10))

      const data = (await response.json()) as Signal
      setSignal(data)
      setSaved(false)
      setMarketConditionChanged(false)

      toast({
        title: data.cached ? "Signal dari Cache" : "Signal Berhasil Dibuat",
        description: `${data.symbol} ${data.signal} • confidence ${(data.confidence * 100).toFixed(1)}%`,
      })
    } catch (error: any) {
      if (error?.name === "AbortError") return
      setSignal(null)
      toast({
        variant: "destructive",
        title: "Gagal Generate Signal",
        description: error instanceof Error ? error.message : "Terjadi kesalahan",
      })
    } finally {
      setLoading(false)
      setRegenerating(false)
    }
  }

  useEffect(() => {
    setLoading(true)
    void fetchSignal()
    return () => abortRef.current?.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey])

  const handleRegenerate = async () => {
    setRegenerating(true)
    setLoading(true)
    await fetchSignal({ force: true })
  }

  const handleSaveToHistory = async () => {
    if (!signal || saving) return
    setSaving(true)

    try {
      const historyItem: SignalHistoryItem = {
        id: signal.id,
        createdAt: signal.timestamp,
        symbol: signal.symbol,
        timeframe: signal.timeframe,
        style: signal.style,
        riskProfile: signal.risk,
        features: {
          trend: signal.technical.trend,
          rsi: signal.technical.rsi,
          atr: signal.technical.atr,
          support: signal.technical.support,
          resistance: signal.technical.resistance,
        },
        signal: {
          bias: signal.signal,
          confidence: signal.confidence,
          entryPrice: signal.entryPrice,
          entryType: signal.entryType,
          stopLoss: signal.stopLoss,
          tp1: signal.tp1,
          tp2: signal.tp2,
          rationale: signal.rationale,
          riskNotes: signal.riskNotes,
        },
      }

      const response = await fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(historyItem),
      })

      if (!response.ok) throw new Error("Failed to validate history item")

      const success = saveToHistory(historyItem)

      setSaved(true)
      toast({
        title: success ? "Signal Tersimpan" : "Signal Sudah Ada",
        description: success ? "Berhasil disimpan ke history" : "Signal ini sudah tersimpan sebelumnya",
      })
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyimpan",
        description: "Terjadi kesalahan saat menyimpan signal",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleCopyLevels = async () => {
    if (!signal) return
    const text = formatLevelsForCopy(signal.symbol, signal.signal, signal.entryPrice, signal.stopLoss, signal.tp1, signal.tp2)

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({ title: "Levels Disalin", description: "Entry, SL, dan TP berhasil disalin" })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ variant: "destructive", title: "Gagal Menyalin", description: "Tidak dapat menyalin ke clipboard" })
    }
  }

  const validityPeriod = signal ? calculateValidityPeriod(signal.timestamp, signal.timeframe) : null

  const handlePriceUpdate = (price: number) => {
    if (!Number.isFinite(price)) return
    setCurrentPrice(price)

    if (!signal) return
    if (!Number.isFinite(signal.entryPrice) || signal.entryPrice <= 0) return

    const priceChangePercent = Math.abs(((price - signal.entryPrice) / signal.entryPrice) * 100)

    if (priceChangePercent >= 1.5 && !marketConditionChanged) {
      setMarketConditionChanged(true)
      toast({
        title: "📊 Market Condition Changed",
        description: `Price moved ${priceChangePercent.toFixed(2)}% - Consider regenerating signal`,
      })
    }
  }

  const handleAlertTriggered = (type: string, level: number) => {
    console.log(`[signal-result] Alert triggered: ${type} at ${level}`)
    if (type === "STOP_LOSS" || type === "TAKE_PROFIT_2") setMarketConditionChanged(true)
  }

  if (loading) return <SignalSkeleton />
  if (rateLimitError)
    return <RateLimitState resetInSeconds={rateLimitError.resetInSeconds} onRetry={() => void handleRegenerate()} />
  if (!signal) return <EmptyState onRetry={() => void handleRegenerate()} />

  const SignalIcon = signal.signal === "BUY" ? ArrowUpRight : signal.signal === "SELL" ? ArrowDownRight : Minus

  const signalColorClass =
    signal.signal === "BUY"
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : signal.signal === "SELL"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"

  const confidenceLevel = getConfidenceLevel(signal.confidence)
  const displayedProbabilities = signal.probabilities ? pickAndNormalizeProbabilities(signal.probabilities, 12) : null

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {(signal.cached || remainingRequests !== null) && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {signal.cached && (
            <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
              <Database className="h-3 w-3 mr-1" />
              Cached ({Math.ceil((signal.cacheExpiresIn || 0) / 60)}m left)
            </Badge>
          )}
          {remainingRequests !== null && (
            <Badge variant="outline" className="bg-gray-500/10 text-gray-600 border-gray-500/20">
              <Zap className="h-3 w-3 mr-1" />
              {remainingRequests} requests tersisa
            </Badge>
          )}
        </div>
      )}

      <LivePriceMonitor
        symbol={signal.symbol}
        timeframe={signal.timeframe}
        entryPrice={signal.entryPrice}
        stopLoss={signal.stopLoss}
        takeProfit1={signal.tp1}
        takeProfit2={signal.tp2}
        signal={signal.signal}
        onPriceUpdate={handlePriceUpdate}
        onAlertTriggered={handleAlertTriggered}
      />

      {validityPeriod && (
        <Card className="border-2 border-blue-500/30 bg-blue-500/5">
          <CardContent className="pt-6">
            <SignalCountdown
              startTime={validityPeriod.startTime}
              endTime={validityPeriod.endTime}
              timeframeMinutes={validityPeriod.minutes}
              onExpired={() => void handleRegenerate()}
              autoRegenerate={autoRegenerate}
            />
          </CardContent>
        </Card>
      )}

      {marketConditionChanged && (
        <Alert className="border-2 border-orange-500/30 bg-orange-500/5">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Market Condition Changed</AlertTitle>
          <AlertDescription>
            Harga telah bergerak signifikan. Pertimbangkan untuk regenerate signal untuk analisa terbaru.
            <Button variant="outline" size="sm" className="mt-2 bg-transparent" onClick={() => void handleRegenerate()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Regenerate Now
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!!signal.warnings?.length && (
        <Card className="border-2 border-yellow-500/30 bg-yellow-500/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Peringatan Normalisasi
            </CardTitle>
            <CardDescription>Beberapa output AI tidak sesuai aturan, sistem menormalkan agar level tetap valid.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {signal.warnings.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                  • {w}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-balance">Signal Generated</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            AI analysis for {signal.symbol} • {signal.timeframe} • {signal.style}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant={autoRegenerate ? "default" : "outline"}
            size="sm"
            onClick={() => setAutoRegenerate(!autoRegenerate)}
            title={autoRegenerate ? "Auto-refresh ON" : "Auto-refresh OFF"}
          >
            <RefreshCw className={`h-4 w-4 sm:mr-2 ${autoRegenerate ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">{autoRegenerate ? "Auto ON" : "Auto OFF"}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={() => void handleRegenerate()} disabled={regenerating}>
            {regenerating ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                <span className="hidden sm:inline">Generating...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Regenerate</span>
              </>
            )}
          </Button>

          <Button variant="outline" size="sm" onClick={() => void handleCopyLevels()} disabled={copied}>
            {copied ? (
              <>
                <Check className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Disalin</span>
              </>
            ) : (
              <>
                <Copy className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Copy Levels</span>
              </>
            )}
          </Button>

          <Button size="sm" onClick={() => void handleSaveToHistory()} disabled={saved || saving}>
            {saving ? (
              <>
                <RefreshCw className="h-4 w-4 sm:mr-2 animate-spin" />
                <span className="hidden sm:inline">Menyimpan...</span>
              </>
            ) : saved ? (
              <>
                <CheckCircle2 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Tersimpan</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Simpan</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* ✅ NEW LAYOUT: 12-col grid to avoid empty gaps */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 lg:grid-cols-12">
        {/* 1) Signal Summary */}
        <Card className="border-2 lg:col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Signal Summary</CardTitle>
            <CardDescription>AI recommendation and confidence level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Signal Type</span>
              <Badge className={`flex items-center gap-1.5 px-3 py-1 text-sm sm:text-base font-bold ${signalColorClass}`}>
                <SignalIcon className="h-4 w-4 sm:h-5 sm:w-5" />
                {signal.signal}
              </Badge>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Confidence Level</span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${confidenceLevel.bgColor} ${confidenceLevel.color}`}>
                    {confidenceLevel.label}
                  </Badge>
                  <span className="font-semibold">{(signal.confidence * 100).toFixed(1)}%</span>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                <div
                  className={`h-full transition-all duration-500 ${
                    signal.confidence >= 0.75 ? "bg-green-500" : signal.confidence >= 0.5 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${signal.confidence * 100}%` }}
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                Generated Time
              </div>
              <p className="text-sm font-medium">{new Date(signal.timestamp).toLocaleString()}</p>
            </div>
          </CardContent>
        </Card>

        {/* 2) Trade Levels */}
        <Card className="border-2 lg:col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Trade Levels</CardTitle>
            <CardDescription>Entry, targets, and stop loss levels</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Entry ({signal.entryType})</span>
              <span className="text-base sm:text-lg font-bold font-mono">{formatPrice(signal.entryPrice, signal.symbol)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Target 1 (TP1)</span>
              <span className="text-base sm:text-lg font-bold text-green-600 font-mono">{formatPrice(signal.tp1, signal.symbol)}</span>
            </div>

            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Target 2 (TP2)</span>
              <span className="text-base sm:text-lg font-bold text-green-600 font-mono">{formatPrice(signal.tp2, signal.symbol)}</span>
            </div>

            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Stop Loss</span>
              <span className="text-base sm:text-lg font-bold text-red-600 font-mono">{formatPrice(signal.stopLoss, signal.symbol)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 3) Probabilities (FULL WIDTH) */}
        {signal.probabilities && displayedProbabilities && (
          <Card className="border-2 lg:col-span-12">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Probabilitas Skenario</CardTitle>
              <CardDescription>
                Menampilkan hanya skenario yang relevan. Jika hanya 1 skenario yang “masuk akal”, maka jadi 100%.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {displayedProbabilities.map((row) => (
                  <div key={row.k} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{row.k}</span>
                      <span className="font-semibold">{row.v}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-secondary">
                      <div className="h-full transition-all duration-500 bg-primary" style={{ width: `${row.v}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              {!!signal.probabilities.explanation?.length && (
                <div className="pt-3 border-t">
                  <p className="text-sm font-medium mb-2">Alasan ringkas</p>
                  <ul className="space-y-2">
                    {signal.probabilities.explanation.slice(0, 6).map((t, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <span className="text-primary font-bold mt-0.5 shrink-0">•</span>
                        <span className="text-muted-foreground">{t}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* 4) Strategy Plan (FULL WIDTH) */}
        {signal.strategyPlan && (
          <Card className="border-2 lg:col-span-12">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">Strategi Level (Actionable)</CardTitle>
              <CardDescription>Trigger → Entry → SL/TP → Invalidation berdasarkan support/resistance.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-3 lg:grid-cols-2">
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <Shield className="h-4 w-4" />
                    Key Levels
                  </div>
                  <div className="text-sm text-muted-foreground space-y-1">
                    <div>
                      Support:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {formatPrice(signal.strategyPlan.keyLevels.support, signal.symbol)}
                      </span>
                    </div>
                    {signal.strategyPlan.keyLevels.support2 !== undefined && (
                      <div>
                        Support 2:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatPrice(signal.strategyPlan.keyLevels.support2, signal.symbol)}
                        </span>
                      </div>
                    )}
                    <div>
                      Resistance:{" "}
                      <span className="font-mono font-semibold text-foreground">
                        {formatPrice(signal.strategyPlan.keyLevels.resistance, signal.symbol)}
                      </span>
                    </div>
                    {signal.strategyPlan.keyLevels.resistance2 !== undefined && (
                      <div>
                        Resistance 2:{" "}
                        <span className="font-mono font-semibold text-foreground">
                          {formatPrice(signal.strategyPlan.keyLevels.resistance2, signal.symbol)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 font-semibold text-sm mb-2">
                    <Target className="h-4 w-4" />
                    Catatan
                  </div>
                  <ul className="space-y-2">
                    {(signal.strategyPlan.notes || []).slice(0, 3).map((n, i) => (
                      <li key={i} className="flex gap-3 text-sm leading-relaxed">
                        <span className="text-primary font-bold mt-0.5 shrink-0">•</span>
                        <span className="text-muted-foreground">{n}</span>
                      </li>
                    ))}
                    {(!signal.strategyPlan.notes || signal.strategyPlan.notes.length === 0) && (
                      <li className="text-sm text-muted-foreground">Tidak ada catatan tambahan.</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 font-semibold mb-3">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                    {signal.strategyPlan.bullish.title}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <strong>Trigger:</strong> {signal.strategyPlan.bullish.trigger}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Entry:</strong> {signal.strategyPlan.bullish.entry}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>SL:</strong> {signal.strategyPlan.bullish.stopLoss}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>TP:</strong> {signal.strategyPlan.bullish.takeProfit}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Invalid:</strong> {signal.strategyPlan.bullish.invalidation}
                    </p>
                  </div>
                </div>

                <div className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 font-semibold mb-3">
                    <TrendingDown className="h-5 w-5 text-red-600" />
                    {signal.strategyPlan.bearish.title}
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="text-muted-foreground">
                      <strong>Trigger:</strong> {signal.strategyPlan.bearish.trigger}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Entry:</strong> {signal.strategyPlan.bearish.entry}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>SL:</strong> {signal.strategyPlan.bearish.stopLoss}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>TP:</strong> {signal.strategyPlan.bearish.takeProfit}
                    </p>
                    <p className="text-muted-foreground">
                      <strong>Invalid:</strong> {signal.strategyPlan.bearish.invalidation}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 5) Rationale */}
        <Card className="border-2 lg:col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Rationale</CardTitle>
            <CardDescription>Why this signal was generated</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {signal.rationale.map((point, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed">
                  <span className="text-primary font-bold mt-0.5 shrink-0">•</span>
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* 6) Risk Notes */}
        <Card className="border-2 lg:col-span-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              Risk Notes
            </CardTitle>
            <CardDescription>Important risk management considerations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {signal.riskNotes.map((note, index) => (
                <li key={index} className="flex gap-3 text-sm leading-relaxed">
                  <span className="text-yellow-600 font-bold mt-0.5 shrink-0">•</span>
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>

            <div className="pt-3 border-t">
              <p className="text-xs text-muted-foreground italic">
                <strong>Disclaimer:</strong> This signal is generated by AI and is not financial advice. Always conduct your
                own research and consult with a qualified financial advisor before making trading decisions.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* 7) PnL (FULL WIDTH) */}
        {currentPrice !== null && signal.signal !== "WAIT" && (
          <div className="lg:col-span-12">
            <PnLCalculator
              signal={signal.signal}
              entryPrice={signal.entryPrice}
              currentPrice={currentPrice}
              stopLoss={signal.stopLoss}
              takeProfit1={signal.tp1}
              takeProfit2={signal.tp2}
              symbol={signal.symbol}
            />
          </div>
        )}
      </div>
    </div>
  )
}