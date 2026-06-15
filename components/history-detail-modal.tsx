"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { ArrowUpRight, ArrowDownRight, Minus, TrendingUp, AlertTriangle, Copy, Check } from "lucide-react"
import type { SignalHistoryItem } from "@/lib/history"
import { formatPrice, getConfidenceLevel, formatLevelsForCopy } from "@/lib/price-format"
import { useToast } from "@/hooks/use-toast"

interface HistoryDetailModalProps {
  item: SignalHistoryItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HistoryDetailModal({ item, open, onOpenChange }: HistoryDetailModalProps) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  if (!item) return null

  const SignalIcon = item.signal.bias === "BUY" ? ArrowUpRight : item.signal.bias === "SELL" ? ArrowDownRight : Minus

  const biasColorClass =
    item.signal.bias === "BUY"
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : item.signal.bias === "SELL"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"

  const confidenceLevel = getConfidenceLevel(item.signal.confidence)

  const handleCopyLevels = async () => {
    const text = formatLevelsForCopy(
      item.symbol,
      item.signal.bias,
      item.signal.entryPrice,
      item.signal.stopLoss,
      item.signal.tp1,
      item.signal.tp2,
    )

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      toast({
        title: "Levels Disalin",
        description: "Entry, SL, dan TP berhasil disalin ke clipboard",
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        variant: "destructive",
        title: "Gagal Menyalin",
        description: "Tidak dapat menyalin ke clipboard",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto mx-4 sm:mx-auto">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-2 sm:gap-3">
            <span>{item.symbol}</span>
            <Badge variant="outline">{item.timeframe}</Badge>
            <Badge className={biasColorClass}>
              <SignalIcon className="h-4 w-4 mr-1" />
              {item.signal.bias}
            </Badge>
            <Badge variant="outline" className={`${confidenceLevel.bgColor} ${confidenceLevel.color}`}>
              {confidenceLevel.label} ({item.signal.confidence}%)
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {new Date(item.createdAt).toLocaleString()} • {item.style} • {item.riskProfile}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6 pt-4">
          {/* Trade Levels */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Trade Levels
              </h4>
              <Button variant="outline" size="sm" onClick={handleCopyLevels} disabled={copied}>
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-1" />
                    Disalin
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-1" />
                    Copy Levels
                  </>
                )}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <div className="rounded-lg border p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Entry ({item.signal.entryType})</p>
                <p className="text-base sm:text-lg font-bold font-mono">
                  {formatPrice(item.signal.entryPrice, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg border p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Stop Loss</p>
                <p className="text-base sm:text-lg font-bold text-red-600 font-mono">
                  {formatPrice(item.signal.stopLoss, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg border p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Take Profit 1</p>
                <p className="text-base sm:text-lg font-bold text-green-600 font-mono">
                  {formatPrice(item.signal.tp1, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg border p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Take Profit 2</p>
                <p className="text-base sm:text-lg font-bold text-green-600 font-mono">
                  {formatPrice(item.signal.tp2, item.symbol)}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Technical Features - Improved mobile grid */}
          <div>
            <h4 className="font-semibold mb-3">Technical Features</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Trend</p>
                <p className="font-semibold capitalize text-sm sm:text-base">{item.features.trend}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">RSI</p>
                <p className="font-semibold text-sm sm:text-base">{item.features.rsi.toFixed(1)}</p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">ATR</p>
                <p className="font-semibold font-mono text-sm sm:text-base">
                  {formatPrice(item.features.atr, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Support</p>
                <p className="font-semibold font-mono text-sm sm:text-base">
                  {formatPrice(item.features.support, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Resistance</p>
                <p className="font-semibold font-mono text-sm sm:text-base">
                  {formatPrice(item.features.resistance, item.symbol)}
                </p>
              </div>
              <div className="rounded-lg bg-muted/50 p-2 sm:p-3">
                <p className="text-xs text-muted-foreground">Confidence</p>
                <p className={`font-semibold text-sm sm:text-base ${confidenceLevel.color}`}>
                  {item.signal.confidence}%
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Rationale */}
          <div>
            <h4 className="font-semibold mb-3">Rationale</h4>
            <ul className="space-y-2">
              {item.signal.rationale.map((point, index) => (
                <li key={index} className="flex gap-2 text-xs sm:text-sm">
                  <span className="text-primary font-bold shrink-0">•</span>
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>
          </div>

          <Separator />

          {/* Risk Notes */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Risk Notes
            </h4>
            <ul className="space-y-2">
              {item.signal.riskNotes.map((note, index) => (
                <li key={index} className="flex gap-2 text-xs sm:text-sm">
                  <span className="text-yellow-600 font-bold shrink-0">•</span>
                  <span className="text-muted-foreground">{note}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
