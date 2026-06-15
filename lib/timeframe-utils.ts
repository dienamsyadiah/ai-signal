export const TIMEFRAME_MINUTES: Record<string, number> = {
  M1: 1,
  M5: 5,
  M15: 15,
  M30: 30,
  H1: 60,
  H2: 120,
  H4: 240,
  D1: 1440,
}

export function getTimeframeMinutes(timeframe: string): number {
  const tf = (timeframe || "").trim().toUpperCase()
  // fallback aman: M15, bukan 60
  return TIMEFRAME_MINUTES[tf] ?? 15
}

export function calculateValidityPeriod(timestamp: string, timeframe: string) {
  const startTime = new Date(timestamp)
  const minutes = getTimeframeMinutes(timeframe)
  const endTime = new Date(startTime.getTime() + minutes * 60 * 1000)

  return { startTime, endTime, minutes }
}

// sisanya tetap
export function formatTime(date: Date): string {
  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

export function formatTimeRange(startTime: Date, endTime: Date): string {
  const start = startTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  const end = endTime.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
  return `${start} - ${end}`
}

export function getRemainingSeconds(endTime: Date): number {
  return Math.max(0, Math.floor((endTime.getTime() - Date.now()) / 1000))
}

export function formatCountdown(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, "0")}`
}