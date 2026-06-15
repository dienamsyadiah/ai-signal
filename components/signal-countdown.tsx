"use client"

import { useEffect, useState } from "react"
import { Clock, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { formatCountdown, formatTimeRange, getRemainingSeconds } from "@/lib/timeframe-utils"

interface SignalCountdownProps {
  startTime: Date
  endTime: Date
  timeframeMinutes: number
  onExpired: () => void
  autoRegenerate?: boolean
}

export function SignalCountdown({
  startTime,
  endTime,
  timeframeMinutes,
  onExpired,
  autoRegenerate = true,
}: SignalCountdownProps) {
  const [remainingSeconds, setRemainingSeconds] = useState(() => getRemainingSeconds(endTime))
  const [hasExpired, setHasExpired] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      const remaining = getRemainingSeconds(endTime)
      setRemainingSeconds(remaining)

      if (remaining === 0 && !hasExpired) {
        setHasExpired(true)
        if (autoRegenerate) {
          onExpired()
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [endTime, hasExpired, onExpired, autoRegenerate])

  const totalSeconds = timeframeMinutes * 60
  const progressPercent = ((totalSeconds - remainingSeconds) / totalSeconds) * 100

  const isExpiringSoon = remainingSeconds <= 60 && remainingSeconds > 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Validitas Signal:</span>
          <Badge variant="outline" className="font-mono text-xs">
            {formatTimeRange(startTime, endTime)}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {hasExpired ? (
            <Badge variant="destructive" className="animate-pulse">
              Signal Expired
            </Badge>
          ) : isExpiringSoon ? (
            <Badge variant="destructive" className="animate-pulse">
              <Clock className="h-3 w-3 mr-1" />
              {formatCountdown(remainingSeconds)}
            </Badge>
          ) : (
            <Badge variant="secondary" className="font-mono">
              <Clock className="h-3 w-3 mr-1" />
              {formatCountdown(remainingSeconds)}
            </Badge>
          )}

          {hasExpired && !autoRegenerate && (
            <Button size="sm" onClick={onExpired} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Progress value={progressPercent} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {hasExpired
            ? autoRegenerate
              ? "Generating signal baru..."
              : "Klik Regenerate untuk signal baru"
            : `Signal akan di-refresh otomatis dalam ${formatCountdown(remainingSeconds)}`}
        </p>
      </div>
    </div>
  )
}
