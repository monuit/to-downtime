/**
 * ETL Scheduler Service
 * 
 * Continuously polls Toronto Open Data APIs at random intervals (5-30 seconds)
 * to ensure fresh disruption data while respecting rate limits.
 * 
 * Features:
 * - Random interval polling (prevents predictable load patterns)
 * - Automatic error recovery with exponential backoff
 * - Request throttling and rate limiting
 * - Performance metrics and logging
 */

import { fetchAllLiveDataWithMetadata } from './live-data.js'
import { upsertDisruption, getActiveDisruptions, resolveDisruption } from './db.js'

interface SchedulerConfig {
  minInterval: number  // Minimum seconds between polls
  maxInterval: number  // Maximum seconds between polls
  maxRetries: number   // Max retry attempts on failure
  backoffMultiplier: number  // Exponential backoff multiplier
  inactivityThresholdMinutes: number  // Minutes before archiving inactive disruptions
}

interface SchedulerStats {
  totalRuns: number
  successfulRuns: number
  failedRuns: number
  lastRunAt: Date | null
  lastSuccessAt: Date | null
  lastError: string | null
  disruptionsProcessed: number
  disruptionsArchived: number
}

class ETLScheduler {
  private config: SchedulerConfig
  private stats: SchedulerStats
  private isRunning: boolean = false
  private currentRetries: number = 0
  private timeoutId: NodeJS.Timeout | null = null

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = {
      minInterval: config.minInterval || 5,      // 5 seconds minimum
      maxInterval: config.maxInterval || 30,     // 30 seconds maximum
      maxRetries: config.maxRetries || 3,
      backoffMultiplier: config.backoffMultiplier || 2,
      inactivityThresholdMinutes: config.inactivityThresholdMinutes || 30,  // 30 minutes default
    }

    this.stats = {
      totalRuns: 0,
      successfulRuns: 0,
      failedRuns: 0,
      lastRunAt: null,
      lastSuccessAt: null,
      lastError: null,
      disruptionsProcessed: 0,
      disruptionsArchived: 0,
    }
  }

  /**
   * Generates random interval between min and max (in milliseconds)
   */
  private getRandomInterval(): number {
    const min = this.config.minInterval * 1000
    const max = this.config.maxInterval * 1000
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  /**
   * Calculates exponential backoff delay for retries
   */
  private getBackoffDelay(): number {
    const baseDelay = this.config.maxInterval * 1000
    return baseDelay * Math.pow(this.config.backoffMultiplier, this.currentRetries)
  }

  /**
   * Executes single ETL run
   */
  private async runETL(): Promise<void> {
    const startTime = Date.now()
    this.stats.totalRuns++
    this.stats.lastRunAt = new Date()

    try {
      console.log(`\n🔄 [ETL Scheduler] Run #${this.stats.totalRuns} starting...`)

      // Fetch live data from all sources
      const result = await fetchAllLiveDataWithMetadata()

      // Create set of current external IDs from API
      const currentExternalIds = new Set(result.disruptions.map(d => d.id))

      // Store/update disruptions in database
      let stored = 0
      for (const disruption of result.disruptions) {
        try {
          await upsertDisruption(disruption.id, {
            type: disruption.type,
            severity: disruption.severity,
            title: disruption.title,
            description: disruption.description,
            affectedLines: disruption.affectedLines,
            sourceApi: disruption.sourceApi,
            sourceUrl: disruption.sourceUrl,
            rawData: disruption.rawData,
          })
          stored++
        } catch (err) {
          console.error(`❌ Failed to store disruption ${disruption.id}:`, err)
        }
      }

      // INACTIVITY DETECTION: Archive disruptions that disappeared from API
      let archived = 0
      try {
        const activeInDb = await getActiveDisruptions()
        const thresholdTime = new Date(Date.now() - this.config.inactivityThresholdMinutes * 60 * 1000)

        for (const dbDisruption of activeInDb) {
          const missingFromApi = !currentExternalIds.has(dbDisruption.external_id)
          const lastFetched = dbDisruption.last_fetched_at ? new Date(dbDisruption.last_fetched_at) : null
          const isStale = lastFetched && lastFetched < thresholdTime

          // Archive if missing from API AND hasn't been seen in threshold time
          if (missingFromApi && isStale) {
            try {
              await resolveDisruption(dbDisruption.external_id)
              archived++
              console.log(`📦 Archived inactive disruption: ${dbDisruption.external_id} (last seen: ${lastFetched?.toISOString()})`)
            } catch (archiveErr) {
              console.error(`❌ Failed to archive ${dbDisruption.external_id}:`, archiveErr)
            }
          }
        }
      } catch (inactivityErr) {
        console.error(`⚠️  Inactivity detection failed:`, inactivityErr)
        // Don't fail the entire ETL run if archival has issues
      }

      const duration = Date.now() - startTime
      this.stats.successfulRuns++
      this.stats.lastSuccessAt = new Date()
      this.stats.disruptionsProcessed += stored
      this.stats.disruptionsArchived += archived
      this.currentRetries = 0 // Reset retry counter on success

      console.log(`✅ [ETL Scheduler] Run #${this.stats.totalRuns} completed in ${duration}ms`)
      console.log(`   📊 Fetched: ${result.disruptions.length} | Stored: ${stored} | Archived: ${archived}`)
      console.log(`   📡 Sources: ${result.metadata.sources.map(s => `${s.name} (${s.count})`).join(', ')}`)

      if (result.metadata.errors.length > 0) {
        console.log(`   ⚠️  Errors: ${result.metadata.errors.join(', ')}`)
      }

    } catch (error) {
      this.stats.failedRuns++
      this.stats.lastError = error instanceof Error ? error.message : String(error)
      this.currentRetries++

      console.error(`❌ [ETL Scheduler] Run #${this.stats.totalRuns} failed:`, error)

      // Exponential backoff if we haven't exceeded max retries
      if (this.currentRetries < this.config.maxRetries) {
        const backoffDelay = this.getBackoffDelay()
        console.log(`⏳ Retry ${this.currentRetries}/${this.config.maxRetries} in ${backoffDelay / 1000}s...`)
        await new Promise(resolve => setTimeout(resolve, backoffDelay))
        return this.runETL() // Recursive retry
      } else {
        console.error(`❌ Max retries (${this.config.maxRetries}) exceeded, will try again next cycle`)
        this.currentRetries = 0 // Reset for next cycle
      }
    }
  }

  /**
   * Schedules next ETL run with random interval
   */
  private scheduleNext(): void {
    if (!this.isRunning) return

    const interval = this.getRandomInterval()
    console.log(`⏰ [ETL Scheduler] Next run in ${interval / 1000}s`)

    this.timeoutId = setTimeout(async () => {
      await this.runETL()
      this.scheduleNext()
    }, interval)
  }

  /**
   * Starts the ETL scheduler
   */
  start(): void {
    if (this.isRunning) {
      console.log('⚠️  [ETL Scheduler] Already running')
      return
    }

    this.isRunning = true
    console.log(`\n🚀 [ETL Scheduler] Starting...`)
    console.log(`   ⏱️  Interval: ${this.config.minInterval}-${this.config.maxInterval}s (random)`)
    console.log(`   🔄 Max Retries: ${this.config.maxRetries}`)
    console.log(`   📈 Backoff Multiplier: ${this.config.backoffMultiplier}x`)

    // Run immediately on start
    this.runETL().then(() => {
      this.scheduleNext()
    })
  }

  /**
   * Stops the ETL scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      console.log('⚠️  [ETL Scheduler] Not running')
      return
    }

    this.isRunning = false
    if (this.timeoutId) {
      clearTimeout(this.timeoutId)
      this.timeoutId = null
    }

    console.log('\n🛑 [ETL Scheduler] Stopped')
    this.printStats()
  }

  /**
   * Prints current scheduler statistics
   */
  printStats(): void {
    const successRate = this.stats.totalRuns > 0
      ? ((this.stats.successfulRuns / this.stats.totalRuns) * 100).toFixed(1)
      : '0'

    console.log('\n📊 [ETL Scheduler] Statistics:')
    console.log(`   Total Runs: ${this.stats.totalRuns}`)
    console.log(`   Successful: ${this.stats.successfulRuns} (${successRate}%)`)
    console.log(`   Failed: ${this.stats.failedRuns}`)
    console.log(`   Disruptions Processed: ${this.stats.disruptionsProcessed}`)
    console.log(`   Last Run: ${this.stats.lastRunAt?.toISOString() || 'Never'}`)
    console.log(`   Last Success: ${this.stats.lastSuccessAt?.toISOString() || 'Never'}`)
    if (this.stats.lastError) {
      console.log(`   Last Error: ${this.stats.lastError}`)
    }
  }

  /**
   * Gets current statistics
   */
  getStats(): SchedulerStats {
    return { ...this.stats }
  }
}

// Export singleton instance
export const etlScheduler = new ETLScheduler({
  minInterval: 5,   // 5 seconds minimum
  maxInterval: 30,  // 30 seconds maximum
  maxRetries: 3,
  backoffMultiplier: 2,
})

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('\n📡 Received SIGTERM signal')
  etlScheduler.stop()
  process.exit(0)
})

process.on('SIGINT', () => {
  console.log('\n📡 Received SIGINT signal')
  etlScheduler.stop()
  process.exit(0)
})
