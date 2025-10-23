import crypto from 'crypto'
import { getActiveDisruptions, upsertDisruption, resolveDisruption, isDuplicate, recordContentHash, cleanupOldResolved } from './db.ts'
import { transformData, RawDisruptionData } from './etl.ts'

/**
 * Production Sync Service
 * Runs periodically on Vercel to:
 * 1. Fetch fresh disruption data
 * 2. Upsert new/updated disruptions
 * 3. Deduplicate
 * 4. Resolve missing ones (archive)
 * 5. Clean up old records
 *
 * Can be called from:
 * - Vercel Cron Functions (scheduled)
 * - API endpoint (manual trigger)
 * - Background jobs
 */

/**
 * Generate deterministic hash of disruption content
 */
const generateContentHash = (disruption: RawDisruptionData): string => {
  const content = `${disruption.type}|${disruption.severity}|${disruption.title}|${disruption.description}`
  return crypto.createHash('sha256').update(content).digest('hex')
}

/**
 * Main sync function
 */
export const syncDisruptions = async (rawData?: any[]): Promise<{
  synced: number
  updated: number
  resolved: number
  duplicates: number
  cleaned: number
}> => {
  console.log('🔄 [SYNC] Starting disruption sync...')

  const stats = {
    synced: 0,
    updated: 0,
    resolved: 0,
    duplicates: 0,
    cleaned: 0,
  }

  try {
    // Step 1: Fetch or use provided data
    console.log('📡 [SYNC] Fetching disruption data...')
    const disruptions = rawData || (await fetchDisruptionData())
    const transformed = transformData(disruptions)
    console.log(`   ✓ Got ${transformed.length} disruptions`)

    // Step 2: Upsert new/updated disruptions
    console.log('💾 [SYNC] Upserting disruptions...')
    const incomingIds = new Set<string>()

    for (const disruption of transformed) {
      try {
        const contentHash = generateContentHash(disruption)

        // Check if this exact content already exists
        const isDup = await isDuplicate(disruption.id, contentHash)
        if (isDup) {
          stats.duplicates++
          continue
        }

        const result = await upsertDisruption(disruption.id, {
          type: disruption.type,
          severity: disruption.severity,
          title: disruption.title,
          description: disruption.description,
          affectedLines: disruption.affectedLines,
        })

        await recordContentHash(result.id, contentHash)
        incomingIds.add(disruption.id)
        stats.synced++
      } catch (error) {
        console.warn(`   ⚠ Failed to sync ${disruption.id}:`, error)
      }
    }

    // Step 3: Resolve disruptions that no longer exist
    console.log('🔍 [SYNC] Checking for resolved disruptions...')
    const activeDisruptions = await getActiveDisruptions()

    for (const active of activeDisruptions) {
      if (!incomingIds.has(active.external_id)) {
        try {
          await resolveDisruption(active.external_id)
          stats.resolved++
          console.log(`   ✓ Resolved: ${active.external_id}`)
        } catch (error) {
          console.warn(`   ⚠ Failed to resolve ${active.external_id}:`, error)
        }
      }
    }

    // Step 4: Clean up old resolved records
    console.log('🧹 [SYNC] Cleaning up old records...')
    stats.cleaned = await cleanupOldResolved(30) // Keep 30 days of history
    console.log(`   ✓ Cleaned ${stats.cleaned} old records`)

    console.log('\n✅ [SYNC] Disruption sync complete')
    console.log(`   📊 Synced: ${stats.synced}, Updated: ${stats.updated}, Resolved: ${stats.resolved}, Duplicates: ${stats.duplicates}`)

    return stats
  } catch (error) {
    console.error('❌ [SYNC] Sync failed:', error)
    throw error
  }
}

/**
 * Fetch disruption data from Toronto Open Data
 * (In production, this connects to real GTFS-RT and open data sources)
 */
const fetchDisruptionData = async (): Promise<any[]> => {
  // TODO: Implement real data fetching from:
  // - TTC GTFS-RT feed
  // - Toronto Open Data portal
  // - City traffic incidents API
  console.log('   ℹ Using stub data (implement real fetching)')
  return []
}

/**
 * Export for Vercel API route
 * Usage: POST /api/sync
 */
export const syncHandler = async (req: any, res: any): Promise<void> => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  try {
    const stats = await syncDisruptions(req.body?.data)
    res.status(200).json({ success: true, stats })
  } catch (error) {
    console.error('API sync error:', error)
    res.status(500).json({ error: 'Sync failed' })
  }
}

/**
 * Scheduled sync for Vercel Cron
 * Usage: export const config = { schedule: '0 30 * * * *' } (every 30 minutes)
 */
export const cronHandler = async (req: any): Promise<Response> => {
  try {
    const stats = await syncDisruptions()
    return new Response(JSON.stringify({ success: true, stats }), { status: 200 })
  } catch (error) {
    console.error('Cron sync error:', error)
    return new Response(JSON.stringify({ error: 'Sync failed' }), { status: 500 })
  }
}

export default syncDisruptions
