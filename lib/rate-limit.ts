// Simple in-memory rate limiter per IP
interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map()
  private cleanupInterval: NodeJS.Timeout | null = null

  // Default: 10 requests per hour
  private maxRequests: number
  private windowMs: number

  constructor(maxRequests = 10, windowMs: number = 60 * 60 * 1000) {
    this.maxRequests = maxRequests
    this.windowMs = windowMs

    // Cleanup expired entries every 5 minutes
    if (typeof setInterval !== "undefined") {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  // Check if request is allowed and increment counter
  check(identifier: string): { allowed: boolean; remaining: number; resetInSeconds: number } {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    // No existing entry or window expired - create new window
    if (!entry || now > entry.resetAt) {
      this.limits.set(identifier, {
        count: 1,
        resetAt: now + this.windowMs,
      })
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetInSeconds: Math.ceil(this.windowMs / 1000),
      }
    }

    // Check if limit exceeded
    if (entry.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
      }
    }

    // Increment counter
    entry.count++
    return {
      allowed: true,
      remaining: this.maxRequests - entry.count,
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  // Get current status without incrementing
  getStatus(identifier: string): { count: number; remaining: number; resetInSeconds: number } {
    const now = Date.now()
    const entry = this.limits.get(identifier)

    if (!entry || now > entry.resetAt) {
      return {
        count: 0,
        remaining: this.maxRequests,
        resetInSeconds: Math.ceil(this.windowMs / 1000),
      }
    }

    return {
      count: entry.count,
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetInSeconds: Math.ceil((entry.resetAt - now) / 1000),
    }
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetAt) {
        this.limits.delete(key)
      }
    }
  }

  // For debugging/monitoring
  getStats(): { totalIPs: number; blockedIPs: number } {
    const now = Date.now()
    let blocked = 0
    for (const entry of this.limits.values()) {
      if (entry.count >= this.maxRequests && now <= entry.resetAt) {
        blocked++
      }
    }
    return {
      totalIPs: this.limits.size,
      blockedIPs: blocked,
    }
  }
}

// Singleton instance: 10 requests per hour
export const signalRateLimiter = new RateLimiter(10, 60 * 60 * 1000)

// Helper to get client IP from request
export function getClientIP(request: Request): string {
  // Try various headers for IP (proxy/load balancer scenarios)
  const forwarded = request.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0].trim()
  }

  const realIP = request.headers.get("x-real-ip")
  if (realIP) {
    return realIP
  }

  // Fallback for development
  return "127.0.0.1"
}
