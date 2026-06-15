"use client"

import type React from "react"
import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

type MarketType = "CRYPTO" | "FOREX" | "METAL"

type SymbolOption = {
  value: string
  label: string
  market: MarketType
}

const SYMBOLS: SymbolOption[] = [
  // ✅ CRYPTO (TwelveData-friendly => USD, not USDT)
  { value: "BTCUSD", label: "BTC/USD", market: "CRYPTO" },
  { value: "ETHUSD", label: "ETH/USD", market: "CRYPTO" },
  { value: "SOLUSD", label: "SOL/USD", market: "CRYPTO" },
  { value: "BNBUSD", label: "BNB/USD", market: "CRYPTO" },
  { value: "XRPUSD", label: "XRP/USD", market: "CRYPTO" },

  // FOREX
  { value: "EURUSD", label: "EUR/USD", market: "FOREX" },
  { value: "GBPUSD", label: "GBP/USD", market: "FOREX" },
  { value: "USDJPY", label: "USD/JPY", market: "FOREX" },

  // METAL
  { value: "XAUUSD", label: "XAU/USD (Gold)", market: "METAL" },
]

const TIMEFRAMES: { value: string; label: string; markets: MarketType[] }[] = [
  // ✅ Allow scalping M5 for ALL markets if you want
  { value: "M5", label: "M5 (5 Menit)", markets: ["CRYPTO", "FOREX", "METAL"] },
  { value: "M15", label: "M15 (15 Menit)", markets: ["CRYPTO", "FOREX", "METAL"] },
  { value: "M30", label: "M30 (30 Menit)", markets: ["CRYPTO", "FOREX", "METAL"] },

  { value: "H1", label: "H1 (1 Jam)", markets: ["CRYPTO", "FOREX", "METAL"] },
  { value: "H4", label: "H4 (4 Jam)", markets: ["CRYPTO", "FOREX", "METAL"] },

  // swing
  { value: "D1", label: "D1 (1 Hari)", markets: ["CRYPTO"] },
]

function detectMarketType(symbol: string): MarketType | null {
  const s = (symbol || "").toUpperCase().replace("/", "")
  if (!s) return null
  if (s.includes("XAU") || s.includes("XAG")) return "METAL"
  // crypto quick check (common tickers + endswith USD/USDT)
  if (s.endsWith("USDT") || s.endsWith("USD") || ["BTC", "ETH", "SOL", "BNB", "XRP"].some((x) => s.startsWith(x))) {
    // If it is a classic 6-letter forex pair, keep it FOREX
    if (/^[A-Z]{6}$/.test(s) && !["BTCUSD", "ETHUSD", "SOLUSD", "BNBUSD", "XRPUSD"].includes(s)) return "FOREX"
    // else crypto
    if (["BTCUSD", "ETHUSD", "SOLUSD", "BNBUSD", "XRPUSD"].includes(s)) return "CRYPTO"
  }
  return "FOREX"
}

export function SignalForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const [formData, setFormData] = useState({
    symbol: "",
    timeframe: "",
    style: "",
    riskProfile: "",
    accountSize: "",
    maxRiskPercent: "",
  })

  const marketType = useMemo(() => detectMarketType(formData.symbol), [formData.symbol])

  const timeframeOptions = useMemo(() => {
    if (!marketType) return TIMEFRAMES
    return TIMEFRAMES.filter((t) => t.markets.includes(marketType))
  }, [marketType])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.symbol || !formData.timeframe || !formData.style || !formData.riskProfile) {
      alert("Mohon lengkapi Symbol, Timeframe, Trading Style, dan Risk Profile.")
      return
    }

    setLoading(true)
    try {
      const params = new URLSearchParams({
        symbol: formData.symbol,
        timeframe: formData.timeframe,
        style: formData.style,
        riskProfile: formData.riskProfile,
        ...(formData.accountSize && { accountSize: formData.accountSize }),
        ...(formData.maxRiskPercent && { maxRiskPercent: formData.maxRiskPercent }),
      })

      await new Promise((resolve) => setTimeout(resolve, 350))
      router.push(`/signal?${params.toString()}`)
    } catch (error) {
      console.error("Error generating signal:", error)
      alert("Terjadi kesalahan saat generate signal.")
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {/* Symbol */}
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="symbol">Symbol</Label>
            {marketType ? (
              <span className="text-[10px] px-2 py-1 rounded-md border text-muted-foreground">Market: {marketType}</span>
            ) : null}
          </div>

          <Select
            value={formData.symbol}
            onValueChange={(value) => {
              const nextMarket = detectMarketType(value)
              setFormData((prev) => {
                const tfStillValid = TIMEFRAMES.some(
                  (t) => t.value === prev.timeframe && (nextMarket ? t.markets.includes(nextMarket) : true),
                )
                return { ...prev, symbol: value, timeframe: tfStillValid ? prev.timeframe : "" }
              })
            }}
            required
          >
            <SelectTrigger id="symbol">
              <SelectValue placeholder="Pilih symbol" />
            </SelectTrigger>

            <SelectContent>
              <div className="px-2 py-1 text-xs text-muted-foreground">CRYPTO (USD)</div>
              {SYMBOLS.filter((s) => s.market === "CRYPTO").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}

              <SelectSeparator />

              <div className="px-2 py-1 text-xs text-muted-foreground">FOREX</div>
              {SYMBOLS.filter((s) => s.market === "FOREX").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}

              <SelectSeparator />

              <div className="px-2 py-1 text-xs text-muted-foreground">METAL</div>
              {SYMBOLS.filter((s) => s.market === "METAL").map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">
            Crypto di sini pakai pair USD (BTCUSD, ETHUSD) agar cocok dengan provider yang kamu pakai.
          </p>
        </div>

        {/* Timeframe */}
        <div className="space-y-2">
          <Label htmlFor="timeframe">Timeframe</Label>
          <Select
            value={formData.timeframe}
            onValueChange={(value) => setFormData({ ...formData, timeframe: value })}
            required
            disabled={!formData.symbol}
          >
            <SelectTrigger id="timeframe">
              <SelectValue placeholder={formData.symbol ? "Pilih timeframe" : "Pilih symbol dulu"} />
            </SelectTrigger>
            <SelectContent>
              {timeframeOptions.map((tf) => (
                <SelectItem key={tf.value} value={tf.value}>
                  {tf.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <p className="text-xs text-muted-foreground">
            {marketType === "CRYPTO"
              ? "Crypto: M5/M15/H1 cocok untuk signal cepat."
              : "Forex/Metal: M5 untuk scalping, M15/H1 lebih stabil."}
          </p>
        </div>

        {/* Trading Style */}
        <div className="space-y-2">
          <Label htmlFor="style">Trading Style</Label>
          <Select value={formData.style} onValueChange={(value) => setFormData({ ...formData, style: value })} required>
            <SelectTrigger id="style">
              <SelectValue placeholder="Pilih style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Scalping">Scalping</SelectItem>
              <SelectItem value="Swing">Swing</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Mempengaruhi tipe entry & jarak SL/TP</p>
        </div>

        {/* Risk Profile */}
        <div className="space-y-2">
          <Label htmlFor="riskProfile">Risk Profile</Label>
          <Select value={formData.riskProfile} onValueChange={(value) => setFormData({ ...formData, riskProfile: value })} required>
            <SelectTrigger id="riskProfile">
              <SelectValue placeholder="Pilih profil risiko" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Conservative">Conservative</SelectItem>
              <SelectItem value="Moderate">Moderate</SelectItem>
              <SelectItem value="Aggressive">Aggressive</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">Semakin agresif, SL biasanya lebih longgar</p>
        </div>

        {/* Account Size */}
        <div className="space-y-2">
          <Label htmlFor="accountSize">Account Size (Opsional)</Label>
          <Input
            id="accountSize"
            type="number"
            placeholder="contoh: 100"
            value={formData.accountSize}
            onChange={(e) => setFormData({ ...formData, accountSize: e.target.value })}
            min="0"
            step="10"
          />
          <p className="text-xs text-muted-foreground">Saldo akun (USD). Untuk catatan risk management.</p>
        </div>

        {/* Max Risk Percent */}
        <div className="space-y-2">
          <Label htmlFor="maxRiskPercent">Max Risk / Trade (%) (Opsional)</Label>
          <Input
            id="maxRiskPercent"
            type="number"
            placeholder="contoh: 1"
            value={formData.maxRiskPercent}
            onChange={(e) => setFormData({ ...formData, maxRiskPercent: e.target.value })}
            min="0.1"
            max="100"
            step="0.1"
          />
          <p className="text-xs text-muted-foreground">Batas risiko per posisi (persentase).</p>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Generating...
          </>
        ) : (
          "Generate Signal"
        )}
      </Button>
    </form>
  )
}