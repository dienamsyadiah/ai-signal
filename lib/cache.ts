// lib/cache.ts
interface CacheEntry<T> {
  data: T
  expiresAt: number
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60 * 1000)
    }
  }

  static generateSignalKey(symbol: string, timeframe: string, style: string, riskProfile: string): string {
    return `signal:${symbol}:${timeframe}:${style}:${riskProfile}`.toLowerCase()
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return entry.data as T
  }

  set<T>(key: string, data: T, ttlMs: number): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
    })
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  getTTL(key: string): number {
    const entry = this.cache.get(key)
    if (!entry) return 0

    const remaining = entry.expiresAt - Date.now()
    return remaining > 0 ? Math.ceil(remaining / 1000) : 0
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) this.cache.delete(key)
    }
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    }
  }
}

export const signalCache = new MemoryCache()
export const SIGNAL_CACHE_TTL = 10 * 60 * 1000
