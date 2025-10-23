/**
 * TCL Scheduler
 * 
 * Runs Toronto Centreline data fetch ONCE DAILY at 7 AM
 * Does NOT poll frequently - TCL data is static and updates rarely
 */

import { fetchAndStoreTCL, clearTCLCache } from './etl/tcl-fetcher.js'
import { logger } from './logger.js'

interface TCLSchedulerConfig {
  runAtHour: number  // Hour to run (0-23), default 7 for 7 AM
  enabled: boolean
}

class TCLScheduler {
  private config: TCLSchedulerConfig
  private timeoutId: NodeJS.Timeout | null = null
  private isRunning: boolean = false
  private lastRunDate: string | null = null

  constructor(config: Partial<TCLSchedulerConfig> = {}) {
    this.config = {
      runAtHour: config.runAtHour ?? 7,  // Default: 7 AM
      enabled: config.enabled ?? true
    }
  }

  /**
   * Calculate milliseconds until next scheduled run (7 AM)
   */
  private getMillisecondsUntilNextRun(): number {
    const now = new Date()
    const next = new Date()
    
    next.setHours(this.config.runAtHour, 0, 0, 0)
    
    // If we've passed today's run time, schedule for tomorrow
    if (now >= next) {
      next.setDate(next.getDate() + 1)
    }
    
    return next.getTime() - now.getTime()
  }

  /**
   * Get today's date string (YYYY-MM-DD)
   */
  private getTodayDateString(): string {
    const now = new Date()
    return now.toISOString().split('T')[0]
  }

  /**
   * Check if we've already run today
   */
  private hasRunToday(): boolean {
    const today = this.getTodayDateString()
    return this.lastRunDate === today
  }

  /**
   * Execute TCL fetch and store
   */
  private async runTCL(): Promise<void> {
    const today = this.getTodayDateString()

    // Skip if already ran today
    if (this.hasRunToday()) {
      logger.debug(`📍 [TCL Scheduler] Already ran today (${today}), skipping...`)
      this.scheduleNext()
      return
    }

    logger.debug(`\n📍 [TCL Scheduler] Starting daily run at ${new Date().toLocaleTimeString()}...`)

    try {
      const result = await fetchAndStoreTCL()

      if (result.success) {
        logger.debug(`✅ [TCL Scheduler] Success: ${result.segmentsStored} segments stored`)
        if (result.fromCache) {
          logger.debug('   (Using cached data - no refresh needed)')
        } else {
          // Clear cache after successful refresh
          clearTCLCache()
          logger.debug('   Cache cleared for fresh data')
        }
        
        this.lastRunDate = today
      } else {
        logger.error(`❌ [TCL Scheduler] Failed: ${result.error}`)
      }
    } catch (error) {
      logger.error('❌ [TCL Scheduler] Unexpected error:', error)
    }

    // Schedule next run
    this.scheduleNext()
  }

  /**
   * Schedule next daily run
   */
  private scheduleNext(): void {
    if (!this.isRunning || !this.config.enabled) return

    const msUntilNext = this.getMillisecondsUntilNextRun()
    const hoursUntilNext = (msUntilNext / (1000 * 60 * 60)).toFixed(1)

    logger.debug(`⏰ [TCL Scheduler] Next run in ${hoursUntilNext} hours (at ${this.config.runAtHour}:00 AM)`)

    this.timeoutId = setTimeout(() => {
      this.runTCL()
    }, msUntilNext)
  }

  /**
   * Start the TCL scheduler
   */
  start(): void {
    if (!this.config.enabled) {
      logger.debug('📍 [TCL Scheduler] Disabled via config')
      return
    }

    if (this.isRunning) {
      logger.warn('⚠️  [TCL Scheduler] Already running')
      return
    }

    this.isRunning = true
    logger.debug(`\n📍 [TCL Scheduler] Starting...`)
    logger.debug(`   ⏰ Scheduled for: ${this.config.runAtHour}:00 AM daily`)

    // Run immediately on startup if enabled
    this.runTCL()
  }

  /**
   * Stop the TCL scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      logger.debug('⚠️  [TCL Scheduler] Not running')
      return
    }

    this.isRunning = false
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    logger.debug('🛑 [TCL Scheduler] Stopped')
  }

  /**
   * Force immediate run (for testing/manual trigger)
   */
  async runNow(): Promise<void> {
    this.lastRunDate = null // Reset to allow immediate run
    await this.runTCL()
  }
}

// Export singleton instance
export const tclScheduler = new TCLScheduler({
  runAtHour: 7,    // 7 AM
  enabled: true
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.debug('\n📡 Received SIGTERM - stopping TCL scheduler...')
  tclScheduler.stop()
})

process.on('SIGINT', () => {
  logger.debug('\n📡 Received SIGINT - stopping TCL scheduler...')
  tclScheduler.stop()
})
