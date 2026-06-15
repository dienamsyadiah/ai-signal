// History storage utilities using localStorage

export interface SignalHistoryItem {
  id: string
  createdAt: string
  symbol: string
  timeframe: string
  style: string
  riskProfile: string
  features: {
    trend: string
    rsi: number
    atr: number
    support: number
    resistance: number
    lastClose?: number
  }
  signal: {
    bias: "BUY" | "SELL" | "WAIT"
    confidence: number
    entryPrice: number
    entryType: string
    stopLoss: number
    tp1: number
    tp2: number
    rationale: string[]
    riskNotes: string[]
  }
}

const HISTORY_KEY = "signal_history"
const MAX_HISTORY_ITEMS = 100

export function getHistory(): SignalHistoryItem[] {
  if (typeof window === "undefined") return []

  try {
    const stored = localStorage.getItem(HISTORY_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error("[v0] Error reading history:", error)
    return []
  }
}

export function saveToHistory(item: SignalHistoryItem): boolean {
  if (typeof window === "undefined") return false

  try {
    const history = getHistory()

    // Check for duplicates by ID
    if (history.some((h) => h.id === item.id)) {
      return false
    }

    // Add new item at the beginning
    history.unshift(item)

    // Keep only last MAX_HISTORY_ITEMS
    if (history.length > MAX_HISTORY_ITEMS) {
      history.splice(MAX_HISTORY_ITEMS)
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
    return true
  } catch (error) {
    console.error("[v0] Error saving to history:", error)
    return false
  }
}

export function deleteFromHistory(id: string): boolean {
  if (typeof window === "undefined") return false

  try {
    const history = getHistory()
    const filtered = history.filter((item) => item.id !== id)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered))
    return true
  } catch (error) {
    console.error("[v0] Error deleting from history:", error)
    return false
  }
}

export function clearHistory(): boolean {
  if (typeof window === "undefined") return false

  try {
    localStorage.removeItem(HISTORY_KEY)
    return true
  } catch (error) {
    console.error("[v0] Error clearing history:", error)
    return false
  }
}

export function getHistoryById(id: string): SignalHistoryItem | null {
  const history = getHistory()
  return history.find((item) => item.id === id) || null
}
