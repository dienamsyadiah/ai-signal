"use client"

import { useState } from "react"
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

interface PnLCalculatorProps {
  signal: "BUY" | "SELL" | "WAIT"
  entryPrice: number
  currentPrice: number
  stopLoss: number
  takeProfit1: number
  takeProfit2: number
  symbol: string
}

export function PnLCalculator({
  signal,
  entryPrice,
  currentPrice,
  stopLoss,
  takeProfit1,
  takeProfit2,
  symbol,
}: PnLCalculatorProps) {
  const [lotSize, setLotSize] = useState<string>("0.01")
  const [accountCurrency, setAccountCurrency] = useState<string>("USD")

  const lot = Number.parseFloat(lotSize) || 0
  const decimals = symbol === "USDJPY" ? 3 : symbol === "XAUUSD" ? 2 : 5

  // Calculate pip value (simplified)
  const getPipValue = () => {
    if (symbol === "XAUUSD") return 1 // Gold: $1 per 0.01 move for standard lot
    if (symbol.includes("JPY")) return 0.1 // JPY pairs
    return 10 // Standard forex pairs
  }

  const pipValue = getPipValue()
  const pipSize = symbol.includes("JPY") ? 0.01 : 0.0001

  // Calculate P&L
  const calculatePnL = () => {
    if (signal === "WAIT") return 0

    const priceDiff = signal === "BUY" ? currentPrice - entryPrice : entryPrice - currentPrice
    const pips = priceDiff / pipSize
    const pnl = pips * pipValue * lot

    return pnl
  }

  const pnl = calculatePnL()
  const isProfitable = pnl > 0

  // Calculate potential profits
  const potentialTP1 = (() => {
    if (signal === "WAIT") return 0
    const priceDiff = signal === "BUY" ? takeProfit1 - entryPrice : entryPrice - takeProfit1
    const pips = priceDiff / pipSize
    return pips * pipValue * lot
  })()

  const potentialTP2 = (() => {
    if (signal === "WAIT") return 0
    const priceDiff = signal === "BUY" ? takeProfit2 - entryPrice : entryPrice - takeProfit2
    const pips = priceDiff / pipSize
    return pips * pipValue * lot
  })()

  const potentialSL = (() => {
    if (signal === "WAIT") return 0
    const priceDiff = signal === "BUY" ? stopLoss - entryPrice : entryPrice - stopLoss
    const pips = priceDiff / pipSize
    return pips * pipValue * lot
  })()

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="h-5 w-5" />
          Real-time P&L Calculator
        </CardTitle>
        <CardDescription>Calculate profit/loss if position is opened</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="lotSize">Lot Size</Label>
            <Input
              id="lotSize"
              type="number"
              step="0.01"
              min="0.01"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value)}
              placeholder="0.01"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="accountCurrency">Account Currency</Label>
            <Input id="accountCurrency" value={accountCurrency} onChange={(e) => setAccountCurrency(e.target.value)} />
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Entry Price</span>
              <span className="font-mono text-sm">{entryPrice.toFixed(decimals)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Price</span>
              <span className="font-mono text-sm font-semibold">{currentPrice.toFixed(decimals)}</span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-medium">Current P&L</span>
            <Badge
              variant={isProfitable ? "default" : "destructive"}
              className="flex items-center gap-1 text-base px-3 py-1"
            >
              {isProfitable ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
              {pnl >= 0 ? "+" : ""}
              {pnl.toFixed(2)} {accountCurrency}
            </Badge>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Potential TP1</span>
              <span className="font-mono text-green-600">
                +{potentialTP1.toFixed(2)} {accountCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Potential TP2</span>
              <span className="font-mono text-green-600">
                +{potentialTP2.toFixed(2)} {accountCurrency}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Potential SL</span>
              <span className="font-mono text-red-600">
                {potentialSL.toFixed(2)} {accountCurrency}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-3 border-t text-xs text-muted-foreground">
          Calculations are estimates. Actual P&L may vary based on spread, commission, and swap.
        </div>
      </CardContent>
    </Card>
  )
}
