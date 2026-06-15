"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ArrowUpRight, ArrowDownRight, Minus, Trash2, Eye } from "lucide-react"
import type { SignalHistoryItem } from "@/lib/history"
import { formatPrice, getConfidenceLevel } from "@/lib/price-format"

interface HistoryCardProps {
  item: SignalHistoryItem
  onView: (item: SignalHistoryItem) => void
  onDelete: (id: string) => void
}

export function HistoryCard({ item, onView, onDelete }: HistoryCardProps) {
  const SignalIcon = item.signal.bias === "BUY" ? ArrowUpRight : item.signal.bias === "SELL" ? ArrowDownRight : Minus

  const biasColorClass =
    item.signal.bias === "BUY"
      ? "bg-green-500/10 text-green-600 border-green-500/20"
      : item.signal.bias === "SELL"
        ? "bg-red-500/10 text-red-600 border-red-500/20"
        : "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"

  const confidenceLevel = getConfidenceLevel(item.signal.confidence)

  return (
    <Card className="hover:border-primary/50 transition-colors">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          {/* Left: Symbol and info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <h3 className="font-bold text-base sm:text-lg">{item.symbol}</h3>
              <Badge variant="outline" className="text-xs">
                {item.timeframe}
              </Badge>
              <Badge className={`text-xs ${biasColorClass}`}>
                <SignalIcon className="h-3 w-3 mr-1" />
                {item.signal.bias}
              </Badge>
              <Badge variant="outline" className={`text-xs ${confidenceLevel.bgColor} ${confidenceLevel.color}`}>
                {confidenceLevel.label}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-muted-foreground mb-2 sm:mb-3">
              <span>{item.style}</span>
              <span className="hidden sm:inline">•</span>
              <span>{item.riskProfile}</span>
              <span className="hidden sm:inline">•</span>
              <span>{new Date(item.createdAt).toLocaleDateString()}</span>
            </div>

            {/* Trade levels preview - Use formatPrice */}
            <div className="flex flex-wrap gap-2 sm:gap-3 text-xs">
              <div className="bg-muted/50 px-2 py-1 rounded">
                <span className="text-muted-foreground">Entry: </span>
                <span className="font-semibold font-mono">{formatPrice(item.signal.entryPrice, item.symbol)}</span>
              </div>
              <div className="bg-muted/50 px-2 py-1 rounded">
                <span className="text-muted-foreground">SL: </span>
                <span className="font-semibold text-red-600 font-mono">
                  {formatPrice(item.signal.stopLoss, item.symbol)}
                </span>
              </div>
              <div className="bg-muted/50 px-2 py-1 rounded">
                <span className="text-muted-foreground">TP1: </span>
                <span className="font-semibold text-green-600 font-mono">
                  {formatPrice(item.signal.tp1, item.symbol)}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Actions - Horizontal on mobile */}
          <div className="flex gap-2 sm:flex-col">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none bg-transparent"
              onClick={() => onView(item)}
            >
              <Eye className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Detail</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-1 sm:flex-none"
              onClick={() => onDelete(item.id)}
            >
              <Trash2 className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Hapus</span>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
