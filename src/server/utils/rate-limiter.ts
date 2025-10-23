/**
 * Rate Limiter Utility
 * 
 * Prevents API abuse by throttling requests with:
 * - Minimum delay between requests
 * - Exponential backoff on errors
 * - Request queue management
 */

interface RateLimiterConfig {
  minDelayMs: number        // Minimum milliseconds between requests
  maxRetries: number        // Maximum retry attempts
  backoffMultiplier: number // Exponential backoff factor
}

export class RateLimiter {
  private config: RateLimiterConfig
  private lastRequestTime: number = 0
  private requestQueue: Promise<any> = Promise.resolve()

  constructor(config: Partial<RateLimiterConfig> = {}) {
    this.config = {
      minDelayMs: config.minDelayMs || 1000,        // 1 second default
      maxRetries: config.maxRetries || 3,
      backoffMultiplier: config.backoffMultiplier || 2,
    }
  }

  /**
   * Executes a function with rate limiting
   */
  async execute<T>(fn: () => Promise<T>, retries: number = 0): Promise<T> {
    // Calculate required delay
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const delay = Math.max(0, this.config.minDelayMs - timeSinceLastRequest)

    // Wait for delay
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }

    // Update last request time
    this.lastRequestTime = Date.now()

    try {
      // Execute the function
      return await fn()
    } catch (error) {
      // Retry with exponential backoff if retries available
      if (retries < this.config.maxRetries) {
        const backoffDelay = this.config.minDelayMs * Math.pow(this.config.backoffMultiplier, retries)
        console.log(`⏳ Rate limiter: Retry ${retries + 1}/${this.config.maxRetries} after ${backoffDelay}ms`)
        
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        return this.execute(fn, retries + 1)
      }
      
      // Max retries exceeded, throw error
      throw error
    }
  }

  /**
   * Executes a function with rate limiting and queuing
   * Ensures requests are executed in order
   */
  async executeQueued<T>(fn: () => Promise<T>): Promise<T> {
    // Add to queue
    const promise = this.requestQueue.then(() => this.execute(fn))
    this.requestQueue = promise.catch(() => {}) // Prevent queue from breaking on errors
    return promise
  }

  /**
   * Delays execution by specified milliseconds
   */
  static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Creates a random delay within range
   */
  static randomDelay(minMs: number, maxMs: number): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
    return RateLimiter.delay(delay)
  }
}

// Export singleton instances for different services
export const ckanRateLimiter = new RateLimiter({
  minDelayMs: 1000,      // 1 second between CKAN API requests
  maxRetries: 3,
  backoffMultiplier: 2,
})

export const geocodingRateLimiter = new RateLimiter({
  minDelayMs: 1000,      // 1 second for geocoding (Nominatim limit: 1 req/sec)
  maxRetries: 3,
  backoffMultiplier: 2,
})
